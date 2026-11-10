-- Tamaverse Diamond Giveaway: secure shareable claim links.
-- Additive migration. Does not alter existing Diamond/top-up flows.

create table if not exists public.tamaverse_diamond_giveaways (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null default 'Diamond Giveaway',
  diamonds integer not null check (diamonds between 1 and 100000),
  quota integer not null check (quota between 1 and 1000000),
  claimed_count integer not null default 0 check (claimed_count >= 0 and claimed_count <= quota),
  expires_at timestamptz not null,
  is_active boolean not null default true,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tamaverse_giveaway_expiry_future check (expires_at > created_at)
);

create table if not exists public.tamaverse_diamond_giveaway_claims (
  id bigserial primary key,
  giveaway_id uuid not null references public.tamaverse_diamond_giveaways(id),
  owner_id uuid not null references auth.users(id) on delete cascade,
  diamonds integer not null check (diamonds > 0),
  balance_after bigint not null check (balance_after >= 0),
  claimed_at timestamptz not null default now(),
  unique (giveaway_id, owner_id)
);

create index if not exists tamaverse_giveaways_active_expiry_idx
  on public.tamaverse_diamond_giveaways(is_active, expires_at);
create index if not exists tamaverse_giveaway_claims_owner_idx
  on public.tamaverse_diamond_giveaway_claims(owner_id, claimed_at desc);

alter table public.tamaverse_diamond_giveaways enable row level security;
alter table public.tamaverse_diamond_giveaway_claims enable row level security;
revoke all on public.tamaverse_diamond_giveaways from public, anon, authenticated;
revoke all on public.tamaverse_diamond_giveaway_claims from public, anon, authenticated;

-- Only the existing Nexora owner account may create or manage giveaways.
create or replace function public.tamaverse_is_giveaway_admin(p_owner uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.tamaverse_telegram_links l
    where l.owner_id = p_owner
      and l.telegram_user_id = '8906658395'
  );
$$;
revoke all on function public.tamaverse_is_giveaway_admin(uuid) from public, anon, authenticated;

create or replace function public.tamaverse_create_diamond_giveaway(
  p_title text,
  p_diamonds integer,
  p_quota integer,
  p_expires_at timestamptz
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_code text;
  v_row public.tamaverse_diamond_giveaways%rowtype;
begin
  if v_owner is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.tamaverse_is_giveaway_admin(v_owner) then raise exception 'OWNER_ONLY'; end if;
  if p_diamonds is null or p_diamonds < 1 or p_diamonds > 100000
     or p_quota is null or p_quota < 1 or p_quota > 1000000
     or p_expires_at is null or p_expires_at <= now() then
    raise exception 'INVALID_GIVEAWAY_SETTINGS';
  end if;
  if length(trim(coalesce(p_title, ''))) < 3 or length(p_title) > 80 then
    raise exception 'INVALID_GIVEAWAY_TITLE';
  end if;

  v_code := encode(extensions.gen_random_bytes(24), 'hex');
  insert into public.tamaverse_diamond_giveaways
    (code, title, diamonds, quota, expires_at, created_by)
  values
    (v_code, trim(p_title), p_diamonds, p_quota, p_expires_at, v_owner)
  returning * into v_row;

  return jsonb_build_object(
    'success', true, 'id', v_row.id, 'code', v_row.code,
    'title', v_row.title, 'diamonds', v_row.diamonds,
    'quota', v_row.quota, 'claimed_count', v_row.claimed_count,
    'expires_at', v_row.expires_at
  );
end;
$$;

create or replace function public.tamaverse_update_diamond_giveaway(
  p_giveaway_id uuid,
  p_quota integer,
  p_expires_at timestamptz,
  p_is_active boolean default true
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_row public.tamaverse_diamond_giveaways%rowtype;
begin
  if v_owner is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.tamaverse_is_giveaway_admin(v_owner) then raise exception 'OWNER_ONLY'; end if;
  if p_quota is null or p_quota < 1 or p_quota > 1000000
     or p_expires_at is null or p_expires_at <= now() then
    raise exception 'INVALID_GIVEAWAY_SETTINGS';
  end if;

  update public.tamaverse_diamond_giveaways
  set quota = p_quota,
      expires_at = p_expires_at,
      is_active = coalesce(p_is_active, true),
      updated_at = now()
  where id = p_giveaway_id
    and claimed_count <= p_quota
  returning * into v_row;

  if not found then raise exception 'GIVEAWAY_NOT_FOUND_OR_QUOTA_TOO_LOW'; end if;
  return jsonb_build_object(
    'success', true, 'id', v_row.id, 'quota', v_row.quota,
    'claimed_count', v_row.claimed_count, 'expires_at', v_row.expires_at,
    'is_active', v_row.is_active
  );
end;
$$;

create or replace function public.tamaverse_claim_diamond_giveaway(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_giveaway public.tamaverse_diamond_giveaways%rowtype;
  v_balance bigint;
begin
  if v_owner is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_code is null or length(trim(p_code)) <> 48 then
    raise exception 'INVALID_GIVEAWAY_LINK';
  end if;

  select * into v_giveaway
  from public.tamaverse_diamond_giveaways
  where code = lower(trim(p_code))
  for update;

  if not found then raise exception 'GIVEAWAY_NOT_FOUND'; end if;
  if not v_giveaway.is_active then raise exception 'GIVEAWAY_INACTIVE'; end if;
  if v_giveaway.expires_at <= now() then raise exception 'GIVEAWAY_EXPIRED'; end if;
  if v_giveaway.claimed_count >= v_giveaway.quota then raise exception 'GIVEAWAY_SOLD_OUT'; end if;
  if exists (
    select 1 from public.tamaverse_diamond_giveaway_claims
    where giveaway_id = v_giveaway.id and owner_id = v_owner
  ) then
    raise exception 'GIVEAWAY_ALREADY_CLAIMED';
  end if;

  insert into public.inventory(owner_id) values (v_owner)
  on conflict (owner_id) do nothing;

  update public.inventory
  set diamonds = diamonds + v_giveaway.diamonds,
      updated_at = now()
  where owner_id = v_owner
  returning diamonds into v_balance;

  insert into public.tamaverse_diamond_giveaway_claims
    (giveaway_id, owner_id, diamonds, balance_after)
  values (v_giveaway.id, v_owner, v_giveaway.diamonds, v_balance);

  update public.tamaverse_diamond_giveaways
  set claimed_count = claimed_count + 1, updated_at = now()
  where id = v_giveaway.id;

  return jsonb_build_object(
    'success', true, 'title', v_giveaway.title,
    'diamonds_received', v_giveaway.diamonds,
    'diamonds', v_balance,
    'claimed_count', v_giveaway.claimed_count + 1,
    'quota', v_giveaway.quota
  );
end;
$$;

revoke all on function public.tamaverse_create_diamond_giveaway(text,integer,integer,timestamptz) from public, anon;
grant execute on function public.tamaverse_create_diamond_giveaway(text,integer,integer,timestamptz) to authenticated;
revoke all on function public.tamaverse_update_diamond_giveaway(uuid,integer,timestamptz,boolean) from public, anon;
grant execute on function public.tamaverse_update_diamond_giveaway(uuid,integer,timestamptz,boolean) to authenticated;
revoke all on function public.tamaverse_claim_diamond_giveaway(text) from public, anon;
grant execute on function public.tamaverse_claim_diamond_giveaway(text) to authenticated;
