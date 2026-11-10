-- Tamaverse Giveaways: shareable links for Diamonds and existing inventory items.
-- Additive migration. Does not alter top-up, shop purchase, or existing reward flows.

alter table public.inventory
  add column if not exists food integer not null default 0 check (food >= 0);

create table if not exists public.tamaverse_giveaways (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  reward_type text not null check (reward_type in ('diamonds','item')),
  diamonds integer,
  item_key text,
  item_quantity integer,
  quota integer not null check (quota between 1 and 1000000),
  claimed_count integer not null default 0 check (claimed_count >= 0 and claimed_count <= quota),
  expires_at timestamptz not null,
  is_active boolean not null default true,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tamaverse_giveaway_reward_valid check (
    (reward_type = 'diamonds' and diamonds between 1 and 100000 and item_key is null and item_quantity is null)
    or
    (reward_type = 'item' and diamonds is null and item_key in ('food','energy','snack','training','rename_card','rename_pet_card') and item_quantity between 1 and 10000)
  ),
  constraint tamaverse_giveaway_expiry_future check (expires_at > created_at)
);

create table if not exists public.tamaverse_giveaway_claims (
  id bigserial primary key,
  giveaway_id uuid not null references public.tamaverse_giveaways(id),
  owner_id uuid not null references auth.users(id) on delete cascade,
  reward_type text not null check (reward_type in ('diamonds','item')),
  reward_key text not null,
  reward_quantity integer not null check (reward_quantity > 0),
  balance_after bigint,
  claimed_at timestamptz not null default now(),
  unique (giveaway_id, owner_id)
);

create index if not exists tamaverse_giveaways_active_expiry_idx
  on public.tamaverse_giveaways(is_active, expires_at);
create index if not exists tamaverse_giveaway_claims_owner_idx
  on public.tamaverse_giveaway_claims(owner_id, claimed_at desc);

alter table public.tamaverse_giveaways enable row level security;
alter table public.tamaverse_giveaway_claims enable row level security;
revoke all on public.tamaverse_giveaways from public, anon, authenticated;
revoke all on public.tamaverse_giveaway_claims from public, anon, authenticated;

-- Admin is the existing Nexora owner Telegram account.
create or replace function public.tamaverse_is_giveaway_admin(p_owner uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.tamaverse_telegram_links l
    where l.owner_id = p_owner and l.telegram_user_id = '8906658395'
  );
$$;
revoke all on function public.tamaverse_is_giveaway_admin(uuid) from public, anon, authenticated;

create or replace function public.tamaverse_create_giveaway(
  p_title text,
  p_reward_type text,
  p_diamonds integer,
  p_item_key text,
  p_item_quantity integer,
  p_quota integer,
  p_expires_at timestamptz
) returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_code text;
  v_row public.tamaverse_giveaways%rowtype;
begin
  if v_owner is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.tamaverse_is_giveaway_admin(v_owner) then raise exception 'OWNER_ONLY'; end if;
  if length(trim(coalesce(p_title,''))) < 3 or length(p_title) > 80
     or p_quota is null or p_quota < 1 or p_quota > 1000000
     or p_expires_at is null or p_expires_at <= now() then
    raise exception 'INVALID_GIVEAWAY_SETTINGS';
  end if;
  if p_reward_type = 'diamonds' then
    if p_diamonds is null or p_diamonds < 1 or p_diamonds > 100000 then
      raise exception 'INVALID_GIVEAWAY_REWARD';
    end if;
  elsif p_reward_type = 'item' then
    if p_item_key not in ('food','energy','snack','training','rename_card','rename_pet_card')
       or p_item_quantity is null or p_item_quantity < 1 or p_item_quantity > 10000 then
      raise exception 'INVALID_GIVEAWAY_REWARD';
    end if;
  else
    raise exception 'INVALID_GIVEAWAY_REWARD_TYPE';
  end if;

  v_code := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  insert into public.tamaverse_giveaways
    (code,title,reward_type,diamonds,item_key,item_quantity,quota,expires_at,created_by)
  values (
    v_code,trim(p_title),p_reward_type,
    case when p_reward_type='diamonds' then p_diamonds else null end,
    case when p_reward_type='item' then p_item_key else null end,
    case when p_reward_type='item' then p_item_quantity else null end,
    p_quota,p_expires_at,v_owner
  ) returning * into v_row;

  return jsonb_build_object(
    'success',true,'id',v_row.id,'code',v_row.code,'title',v_row.title,
    'reward_type',v_row.reward_type,'diamonds',v_row.diamonds,
    'item_key',v_row.item_key,'item_quantity',v_row.item_quantity,
    'quota',v_row.quota,'claimed_count',v_row.claimed_count,'expires_at',v_row.expires_at
  );
end;
$$;

create or replace function public.tamaverse_update_giveaway(
  p_giveaway_id uuid,p_quota integer,p_expires_at timestamptz,p_is_active boolean default true
) returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_row public.tamaverse_giveaways%rowtype;
begin
  if v_owner is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.tamaverse_is_giveaway_admin(v_owner) then raise exception 'OWNER_ONLY'; end if;
  if p_quota is null or p_quota < 1 or p_quota > 1000000
     or p_expires_at is null or p_expires_at <= now() then
    raise exception 'INVALID_GIVEAWAY_SETTINGS';
  end if;
  update public.tamaverse_giveaways
  set quota=p_quota,expires_at=p_expires_at,is_active=coalesce(p_is_active,true),updated_at=now()
  where id=p_giveaway_id and claimed_count<=p_quota
  returning * into v_row;
  if not found then raise exception 'GIVEAWAY_NOT_FOUND_OR_QUOTA_TOO_LOW'; end if;
  return jsonb_build_object('success',true,'id',v_row.id,'quota',v_row.quota,
    'claimed_count',v_row.claimed_count,'expires_at',v_row.expires_at,'is_active',v_row.is_active);
end;
$$;

create or replace function public.tamaverse_get_giveaway(p_code text)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare v_row public.tamaverse_giveaways%rowtype;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_code is null or length(trim(p_code)) <> 64 then raise exception 'INVALID_GIVEAWAY_LINK'; end if;
  select * into v_row from public.tamaverse_giveaways where code=lower(trim(p_code));
  if not found then raise exception 'GIVEAWAY_NOT_FOUND'; end if;
  return jsonb_build_object(
    'success',true,'id',v_row.id,'title',v_row.title,'reward_type',v_row.reward_type,
    'diamonds',v_row.diamonds,'item_key',v_row.item_key,'item_quantity',v_row.item_quantity,
    'quota',v_row.quota,'claimed_count',v_row.claimed_count,'expires_at',v_row.expires_at,
    'is_active',v_row.is_active,'expired',v_row.expires_at<=now(),
    'sold_out',v_row.claimed_count>=v_row.quota
  );
end;
$$;

create or replace function public.tamaverse_claim_giveaway(p_code text)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_giveaway public.tamaverse_giveaways%rowtype;
  v_balance bigint;
  v_item_count integer;
begin
  if v_owner is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_code is null or length(trim(p_code)) <> 64 then raise exception 'INVALID_GIVEAWAY_LINK'; end if;

  select * into v_giveaway from public.tamaverse_giveaways
  where code=lower(trim(p_code)) for update;
  if not found then raise exception 'GIVEAWAY_NOT_FOUND'; end if;
  if not v_giveaway.is_active then raise exception 'GIVEAWAY_INACTIVE'; end if;
  if v_giveaway.expires_at<=now() then raise exception 'GIVEAWAY_EXPIRED'; end if;
  if v_giveaway.claimed_count>=v_giveaway.quota then raise exception 'GIVEAWAY_SOLD_OUT'; end if;
  if exists(select 1 from public.tamaverse_giveaway_claims
    where giveaway_id=v_giveaway.id and owner_id=v_owner) then
    raise exception 'GIVEAWAY_ALREADY_CLAIMED';
  end if;

  if v_giveaway.reward_type='diamonds' then
    insert into public.inventory(owner_id) values(v_owner) on conflict(owner_id) do nothing;
    update public.inventory set diamonds=diamonds+v_giveaway.diamonds,updated_at=now()
      where owner_id=v_owner returning diamonds into v_balance;
    insert into public.tamaverse_giveaway_claims
      (giveaway_id,owner_id,reward_type,reward_key,reward_quantity,balance_after)
    values(v_giveaway.id,v_owner,'diamonds','diamonds',v_giveaway.diamonds,v_balance);
  elsif v_giveaway.item_key in ('food','energy','snack','training') then
    insert into public.inventory(owner_id) values(v_owner) on conflict(owner_id) do nothing;
    if v_giveaway.item_key='food' then
      update public.inventory set food=food+v_giveaway.item_quantity,updated_at=now()
        where owner_id=v_owner returning food into v_item_count;
    elsif v_giveaway.item_key='energy' then
      update public.inventory set energy=energy+v_giveaway.item_quantity,updated_at=now()
        where owner_id=v_owner returning energy into v_item_count;
    elsif v_giveaway.item_key='snack' then
      update public.inventory set snack=snack+v_giveaway.item_quantity,updated_at=now()
        where owner_id=v_owner returning snack into v_item_count;
    else
      update public.inventory set training=training+v_giveaway.item_quantity,updated_at=now()
        where owner_id=v_owner returning training into v_item_count;
    end if;
    insert into public.tamaverse_giveaway_claims
      (giveaway_id,owner_id,reward_type,reward_key,reward_quantity)
    values(v_giveaway.id,v_owner,'item',v_giveaway.item_key,v_giveaway.item_quantity);
  else
    insert into public.premium_inventory(owner_id) values(v_owner) on conflict(owner_id) do nothing;
    if v_giveaway.item_key='rename_card' then
      update public.premium_inventory set rename_card_count=rename_card_count+v_giveaway.item_quantity,updated_at=now()
        where owner_id=v_owner;
    elsif v_giveaway.item_key='rename_pet_card' then
      update public.premium_inventory set rename_pet_card_count=rename_pet_card_count+v_giveaway.item_quantity,updated_at=now()
        where owner_id=v_owner;
    end if;
    insert into public.tamaverse_giveaway_claims
      (giveaway_id,owner_id,reward_type,reward_key,reward_quantity)
    values(v_giveaway.id,v_owner,'item',v_giveaway.item_key,v_giveaway.item_quantity);
  end if;

  update public.tamaverse_giveaways set claimed_count=claimed_count+1,updated_at=now()
    where id=v_giveaway.id;
  return jsonb_build_object(
    'success',true,'title',v_giveaway.title,'reward_type',v_giveaway.reward_type,
    'diamonds_received',v_giveaway.diamonds,'item_key',v_giveaway.item_key,
    'item_quantity',v_giveaway.item_quantity,'balance_after',v_balance,
    'claimed_count',v_giveaway.claimed_count+1,'quota',v_giveaway.quota
  );
end;
$$;

create or replace function public.tamaverse_list_giveaways()
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare v_owner uuid:=auth.uid(); v_data jsonb;
begin
  if v_owner is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.tamaverse_is_giveaway_admin(v_owner) then raise exception 'OWNER_ONLY'; end if;
  select coalesce(jsonb_agg(to_jsonb(g) order by g.created_at desc),'[]'::jsonb)
    into v_data from public.tamaverse_giveaways g;
  return v_data;
end;
$$;

revoke all on function public.tamaverse_create_giveaway(text,text,integer,text,integer,integer,timestamptz) from public,anon;
grant execute on function public.tamaverse_create_giveaway(text,text,integer,text,integer,integer,timestamptz) to authenticated;
revoke all on function public.tamaverse_update_giveaway(uuid,integer,timestamptz,boolean) from public,anon;
grant execute on function public.tamaverse_update_giveaway(uuid,integer,timestamptz,boolean) to authenticated;
revoke all on function public.tamaverse_get_giveaway(text) from public,anon;
grant execute on function public.tamaverse_get_giveaway(text) to authenticated;
revoke all on function public.tamaverse_claim_giveaway(text) from public,anon;
grant execute on function public.tamaverse_claim_giveaway(text) to authenticated;
revoke all on function public.tamaverse_list_giveaways() from public,anon;
grant execute on function public.tamaverse_list_giveaways() to authenticated;
