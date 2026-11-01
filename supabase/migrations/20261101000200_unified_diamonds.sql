-- Tamaverse unified premium currency: Diamonds only.
-- Safe to re-run: old Gems are zeroed as they are migrated.
alter table public.inventory
  add column if not exists diamonds bigint not null default 0
  check (diamonds >= 0);

-- Remove the old Gems guard before migrating legacy balances.
drop trigger if exists tamaverse_guard_gem_balance on public.inventory;

update public.inventory
set diamonds = coalesce(diamonds, 0) + coalesce(gems, 0),
    gems = 0
where coalesce(gems, 0) > 0;

-- The old Gems column is intentionally retained temporarily for compatibility
-- with older installed SQL functions. The game no longer reads or writes it.

create or replace function public.purchase_tamaverse_premium_item(p_item_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_cost integer;
  v_item_type text;
  v_diamonds integer;
  v_premium public.premium_inventory%rowtype;
begin
  if v_owner is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  case p_item_id
    when 'rename_card' then v_cost := 50; v_item_type := 'rename';
    when 'rename_pet_card' then v_cost := 50; v_item_type := 'rename_pet';
    when 'frame_royal' then v_cost := 200; v_item_type := 'royal';
    when 'frame_celestial' then v_cost := 300; v_item_type := 'celestial';
    else raise exception 'INVALID_PREMIUM_ITEM';
  end case;

  insert into public.inventory(owner_id) values (v_owner)
  on conflict (owner_id) do nothing;
  insert into public.premium_inventory(owner_id) values (v_owner)
  on conflict (owner_id) do nothing;

  select diamonds into v_diamonds
  from public.inventory
  where owner_id = v_owner
  for update;

  select * into v_premium
  from public.premium_inventory
  where owner_id = v_owner
  for update;

  if v_diamonds < v_cost then
    raise exception 'NOT_ENOUGH_DIAMONDS';
  end if;

  if p_item_id = 'frame_royal' and 'legendary' = any(v_premium.owned_frames) then
    raise exception 'ITEM_ALREADY_OWNED';
  end if;
  if p_item_id = 'frame_celestial' and 'celestial' = any(v_premium.owned_frames) then
    raise exception 'ITEM_ALREADY_OWNED';
  end if;

  update public.inventory
  set diamonds = diamonds - v_cost, updated_at = now()
  where owner_id = v_owner
  returning diamonds into v_diamonds;

  if v_item_type = 'rename' then
    update public.premium_inventory
    set rename_card_count = rename_card_count + 1, updated_at = now()
    where owner_id = v_owner returning * into v_premium;
  elsif v_item_type = 'rename_pet' then
    update public.premium_inventory
    set rename_pet_card_count = rename_pet_card_count + 1, updated_at = now()
    where owner_id = v_owner returning * into v_premium;
  else
    update public.premium_inventory
    set owned_frames = case
      when v_item_type = 'royal' then array(select distinct unnest(owned_frames || array['legendary']::text[]))
      else array(select distinct unnest(owned_frames || array['celestial']::text[]))
    end,
    updated_at = now()
    where owner_id = v_owner returning * into v_premium;
  end if;

  return jsonb_build_object(
    'success', true,
    'diamonds', v_diamonds,
    'rename_card_count', v_premium.rename_card_count,
    'rename_pet_card_count', v_premium.rename_pet_card_count,
    'owned_frames', to_jsonb(v_premium.owned_frames)
  );
end;
$$;

revoke all on function public.purchase_tamaverse_premium_item(text) from public, anon;
grant execute on function public.purchase_tamaverse_premium_item(text) to authenticated;


-- New accounts receive the same 3 starter Diamonds as migrated accounts.
alter table public.inventory alter column gems set default 0;

create or replace function public.create_tamaverse_player()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), 'Penjelajah'))
  on conflict (id) do nothing;

  insert into public.inventory (owner_id, diamonds)
  values (new.id, 3)
  on conflict (owner_id) do nothing;

  insert into public.daily_rewards (owner_id)
  values (new.id)
  on conflict (owner_id) do nothing;

  return new;
end;
$$;

-- All authenticated Diamond spending is atomic and server-controlled.
create or replace function public.tamaverse_spend_diamonds(
  p_amount integer,
  p_reason text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_balance bigint;
  v_limit integer;
begin
  if v_owner is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_reason not in ('astral_gacha', 'quest_rebuy') then
    raise exception 'INVALID_DIAMOND_SPEND_REASON';
  end if;
  v_limit := case when p_reason = 'astral_gacha' then 100 else 1 end;
  if p_amount is null or p_amount < 1 or p_amount > v_limit then
    raise exception 'INVALID_DIAMOND_AMOUNT';
  end if;

  update public.inventory
  set diamonds = diamonds - p_amount, updated_at = now()
  where owner_id = v_owner and diamonds >= p_amount
  returning diamonds into v_balance;

  if not found then raise exception 'NOT_ENOUGH_DIAMONDS'; end if;
  return jsonb_build_object('success', true, 'diamonds', v_balance);
end;
$$;

-- Daily reward cadence is authoritative in the database, preventing repeat claims.
create or replace function public.tamaverse_claim_daily_reward()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_last date;
  v_day smallint;
  v_today date := (now() at time zone 'utc')::date;
  v_diamonds bigint;
begin
  if v_owner is null then raise exception 'AUTH_REQUIRED'; end if;

  insert into public.daily_rewards(owner_id) values (v_owner)
  on conflict (owner_id) do nothing;

  select last_claim_date, day into v_last, v_day
  from public.daily_rewards where owner_id = v_owner for update;

  if v_last = v_today then raise exception 'DAILY_REWARD_ALREADY_CLAIMED'; end if;

  if v_last = v_today - 1 then
    v_day := (v_day % 7) + 1;
  else
    v_day := 1;
  end if;

  update public.daily_rewards
  set last_claim_date = v_today, day = v_day
  where owner_id = v_owner;

  insert into public.inventory(owner_id) values (v_owner)
  on conflict (owner_id) do nothing;

  if v_day = 4 then
    update public.inventory set diamonds = diamonds + 1, updated_at = now()
    where owner_id = v_owner returning diamonds into v_diamonds;
  elsif v_day = 7 then
    update public.inventory set diamonds = diamonds + 2, updated_at = now()
    where owner_id = v_owner returning diamonds into v_diamonds;
  else
    select diamonds into v_diamonds from public.inventory where owner_id = v_owner;
  end if;

  return jsonb_build_object(
    'success', true, 'day', v_day, 'diamonds', v_diamonds,
    'last_claim_date', v_today, 'diamond_reward', case when v_day = 4 then 1 when v_day = 7 then 2 else 0 end
  );
end;
$$;

revoke all on function public.tamaverse_spend_diamonds(integer, text) from public, anon;
grant execute on function public.tamaverse_spend_diamonds(integer, text) to authenticated;
revoke all on function public.tamaverse_claim_daily_reward() from public, anon;
grant execute on function public.tamaverse_claim_daily_reward() to authenticated;


-- Exchange only consumes the server-stored fragment count before granting a Diamond.
create or replace function public.tamaverse_exchange_fragments_for_diamond(p_species_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_fragments jsonb;
  v_count integer;
  v_balance bigint;
begin
  if v_owner is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_species_id is null or length(p_species_id) < 1 or length(p_species_id) > 64 then
    raise exception 'INVALID_SPECIES';
  end if;

  select coalesce(fragments, '{}'::jsonb) into v_fragments
  from public.inventory where owner_id = v_owner for update;
  if not found then raise exception 'INVENTORY_NOT_FOUND'; end if;

  v_count := coalesce((v_fragments ->> p_species_id)::integer, 0);
  if v_count < 5 then raise exception 'NOT_ENOUGH_FRAGMENTS'; end if;

  v_fragments := jsonb_set(v_fragments, array[p_species_id], to_jsonb(v_count - 5), true);
  update public.inventory
  set fragments = v_fragments, diamonds = diamonds + 1, updated_at = now()
  where owner_id = v_owner returning diamonds into v_balance;

  return jsonb_build_object('success', true, 'diamonds', v_balance, 'fragments', v_fragments);
end;
$$;
revoke all on function public.tamaverse_exchange_fragments_for_diamond(text) from public, anon;
grant execute on function public.tamaverse_exchange_fragments_for_diamond(text) to authenticated;
