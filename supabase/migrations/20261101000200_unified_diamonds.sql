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
