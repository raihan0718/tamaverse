-- TAMAVERSE premium store and frame collection
-- Run this migration in Supabase SQL Editor after the starter schema.

create table if not exists public.premium_inventory (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  rename_card_count integer not null default 0 check (rename_card_count >= 0),
  rename_pet_card_count integer not null default 0 check (rename_pet_card_count >= 0),
  owned_frames text[] not null default array['common']::text[],
  updated_at timestamptz not null default now(),
  constraint premium_frames_valid check (
    owned_frames <@ array['common','uncommon','rare','legendary','celestial']::text[]
  )
);

alter table public.premium_inventory enable row level security;
drop policy if exists "Players can read own premium inventory" on public.premium_inventory;
create policy "Players can read own premium inventory"
  on public.premium_inventory for select to authenticated
  using ((select auth.uid()) = owner_id);
grant select on public.premium_inventory to authenticated;
revoke insert, update, delete on public.premium_inventory from anon, authenticated;

insert into public.premium_inventory(owner_id)
select id from auth.users
on conflict (owner_id) do nothing;

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

  insert into public.inventory (owner_id) values (new.id)
  on conflict (owner_id) do nothing;

  insert into public.daily_rewards (owner_id) values (new.id)
  on conflict (owner_id) do nothing;

  insert into public.premium_inventory (owner_id)
  values (new.id)
  on conflict (owner_id) do nothing;

  return new;
end;
$$;

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
  v_gems integer;
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

  select gems into v_gems
  from public.inventory
  where owner_id = v_owner
  for update;

  select * into v_premium
  from public.premium_inventory
  where owner_id = v_owner
  for update;

  if v_gems < v_cost then
    raise exception 'NOT_ENOUGH_GEMS';
  end if;

  if p_item_id = 'frame_royal' and 'legendary' = any(v_premium.owned_frames) then
    raise exception 'ITEM_ALREADY_OWNED';
  end if;
  if p_item_id = 'frame_celestial' and 'celestial' = any(v_premium.owned_frames) then
    raise exception 'ITEM_ALREADY_OWNED';
  end if;

  update public.inventory
  set gems = gems - v_cost, updated_at = now()
  where owner_id = v_owner
  returning gems into v_gems;

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
    'gems', v_gems,
    'rename_card_count', v_premium.rename_card_count,
    'rename_pet_card_count', v_premium.rename_pet_card_count,
    'owned_frames', to_jsonb(v_premium.owned_frames)
  );
end;
$$;

create or replace function public.consume_tamaverse_rename_card(p_card_type text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_premium public.premium_inventory%rowtype;
begin
  if v_owner is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_premium
  from public.premium_inventory
  where owner_id = v_owner
  for update;

  if not found then raise exception 'PREMIUM_INVENTORY_NOT_FOUND'; end if;

  if p_card_type = 'rename' then
    if v_premium.rename_card_count < 1 then raise exception 'NO_RENAME_CARD'; end if;
    update public.premium_inventory
    set rename_card_count = rename_card_count - 1, updated_at = now()
    where owner_id = v_owner returning * into v_premium;
  elsif p_card_type = 'rename_pet' then
    if v_premium.rename_pet_card_count < 1 then raise exception 'NO_RENAME_PET_CARD'; end if;
    update public.premium_inventory
    set rename_pet_card_count = rename_pet_card_count - 1, updated_at = now()
    where owner_id = v_owner returning * into v_premium;
  else
    raise exception 'INVALID_CARD_TYPE';
  end if;

  return jsonb_build_object(
    'success', true,
    'rename_card_count', v_premium.rename_card_count,
    'rename_pet_card_count', v_premium.rename_pet_card_count
  );
end;
$$;

revoke all on function public.purchase_tamaverse_premium_item(text) from public;
revoke all on function public.consume_tamaverse_rename_card(text) from public;
grant execute on function public.purchase_tamaverse_premium_item(text) to authenticated;
grant execute on function public.consume_tamaverse_rename_card(text) to authenticated;
