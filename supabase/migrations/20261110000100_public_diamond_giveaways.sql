-- Public Diamond Giveaways: server-authoritative, quota-limited, one claim per account.
create table if not exists public.tamaverse_diamond_giveaways (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null default 'Diamond Giveaway',
  diamonds bigint not null check (diamonds between 1 and 1000000000),
  max_claims integer not null check (max_claims between 1 and 1000000),
  claim_count integer not null default 0 check (claim_count >= 0 and claim_count <= max_claims),
  expires_at timestamptz,
  status text not null default 'active' check (status in ('active','cancelled','completed','expired')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
create index if not exists tamaverse_diamond_giveaways_created_idx
  on public.tamaverse_diamond_giveaways(created_at desc);

create table if not exists public.tamaverse_diamond_giveaway_claims (
  id bigserial primary key,
  giveaway_id uuid not null references public.tamaverse_diamond_giveaways(id),
  owner_id uuid not null references auth.users(id),
  diamonds bigint not null check (diamonds > 0),
  claimed_at timestamptz not null default now(),
  unique (giveaway_id, owner_id)
);
create index if not exists tamaverse_giveaway_claims_owner_idx
  on public.tamaverse_diamond_giveaway_claims(owner_id, claimed_at desc);

alter table public.tamaverse_diamond_giveaways enable row level security;
alter table public.tamaverse_diamond_giveaway_claims enable row level security;
revoke all on public.tamaverse_diamond_giveaways from public, anon, authenticated;
revoke all on public.tamaverse_diamond_giveaway_claims from public, anon, authenticated;

create or replace function public.tamaverse_create_diamond_giveaway(
  p_diamonds bigint, p_max_claims integer, p_expires_at timestamptz default null,
  p_title text default 'Diamond Giveaway'
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_telegram_id text;
  v_code text;
  v_row public.tamaverse_diamond_giveaways%rowtype;
begin
  if v_actor is null then raise exception 'AUTH_REQUIRED'; end if;
  select l.telegram_user_id::text into v_telegram_id
    from public.tamaverse_telegram_links l
    where l.owner_id = v_actor limit 1;
  if v_telegram_id is distinct from '8906658395' then raise exception 'ADMIN_ONLY'; end if;
  if p_diamonds is null or p_diamonds < 1 or p_diamonds > 1000000000
     or p_max_claims is null or p_max_claims < 1 or p_max_claims > 1000000 then
    raise exception 'INVALID_GIVEAWAY_SETTINGS';
  end if;
  if p_expires_at is not null and p_expires_at <= now() then
    raise exception 'INVALID_EXPIRY';
  end if;
  if length(trim(coalesce(p_title,''))) < 1 or length(p_title) > 80 then
    raise exception 'INVALID_TITLE';
  end if;
  v_code := upper(substr(replace(gen_random_uuid()::text,'-',''),1,12));
  insert into public.tamaverse_diamond_giveaways(code,title,diamonds,max_claims,expires_at,created_by)
  values(v_code,trim(p_title),p_diamonds,p_max_claims,p_expires_at,v_actor)
  returning * into v_row;
  return jsonb_build_object('id',v_row.id,'code',v_row.code,'title',v_row.title,
    'diamonds',v_row.diamonds,'max_claims',v_row.max_claims,'claim_count',v_row.claim_count,
    'expires_at',v_row.expires_at,'status',v_row.status,'created_at',v_row.created_at);
end;
$$;

create or replace function public.tamaverse_list_diamond_giveaways()
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_actor uuid := auth.uid(); v_telegram_id text; v_result jsonb;
begin
  if v_actor is null then raise exception 'AUTH_REQUIRED'; end if;
  select l.telegram_user_id::text into v_telegram_id
    from public.tamaverse_telegram_links l where l.owner_id = v_actor limit 1;
  if v_telegram_id is distinct from '8906658395' then raise exception 'ADMIN_ONLY'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',g.id,'code',g.code,'title',g.title,'diamonds',g.diamonds,
    'max_claims',g.max_claims,'claim_count',g.claim_count,'expires_at',g.expires_at,
    'status',case when g.status='active' and g.expires_at is not null and g.expires_at<=now()
      then 'expired' else g.status end,'created_at',g.created_at
  ) order by g.created_at desc),'[]'::jsonb)
  into v_result from public.tamaverse_diamond_giveaways g where g.created_by=v_actor;
  return v_result;
end;
$$;

create or replace function public.tamaverse_cancel_diamond_giveaway(p_giveaway_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_actor uuid := auth.uid(); v_telegram_id text; v_status text;
begin
  if v_actor is null then raise exception 'AUTH_REQUIRED'; end if;
  select l.telegram_user_id::text into v_telegram_id
    from public.tamaverse_telegram_links l where l.owner_id = v_actor limit 1;
  if v_telegram_id is distinct from '8906658395' then raise exception 'ADMIN_ONLY'; end if;
  update public.tamaverse_diamond_giveaways
    set status='cancelled'
    where id=p_giveaway_id and created_by=v_actor and status='active'
      and (expires_at is null or expires_at>now())
    returning status into v_status;
  if v_status is null then raise exception 'GIVEAWAY_NOT_ACTIVE'; end if;
  return jsonb_build_object('success',true,'status',v_status);
end;
$$;

create or replace function public.tamaverse_claim_diamond_giveaway(p_code text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_giveaway public.tamaverse_diamond_giveaways%rowtype;
  v_balance bigint;
begin
  if v_owner is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_code is null or p_code !~ '^[A-Za-z0-9]{8,16}$' then raise exception 'INVALID_GIVEAWAY_CODE'; end if;
  select * into v_giveaway from public.tamaverse_diamond_giveaways
    where code=upper(p_code) for update;
  if not found then raise exception 'GIVEAWAY_NOT_FOUND'; end if;
  if v_giveaway.status <> 'active' then raise exception 'GIVEAWAY_NOT_ACTIVE'; end if;
  if v_giveaway.expires_at is not null and v_giveaway.expires_at<=now() then
    update public.tamaverse_diamond_giveaways set status='expired' where id=v_giveaway.id;
    raise exception 'GIVEAWAY_EXPIRED';
  end if;
  if v_giveaway.claim_count >= v_giveaway.max_claims then
    update public.tamaverse_diamond_giveaways set status='completed' where id=v_giveaway.id;
    raise exception 'GIVEAWAY_FULL';
  end if;
  insert into public.inventory(owner_id) values(v_owner) on conflict(owner_id) do nothing;
  insert into public.tamaverse_diamond_giveaway_claims(giveaway_id,owner_id,diamonds)
    values(v_giveaway.id,v_owner,v_giveaway.diamonds);
  update public.inventory set diamonds=diamonds+v_giveaway.diamonds,updated_at=now()
    where owner_id=v_owner returning diamonds into v_balance;
  update public.tamaverse_diamond_giveaways
    set claim_count=claim_count+1,
        status=case when claim_count+1>=max_claims then 'completed' else 'active' end
    where id=v_giveaway.id;
  return jsonb_build_object('success',true,'title',v_giveaway.title,
    'diamonds',v_giveaway.diamonds,'balance',v_balance,
    'claim_count',v_giveaway.claim_count+1,'max_claims',v_giveaway.max_claims);
exception
  when unique_violation then raise exception 'GIVEAWAY_ALREADY_CLAIMED';
end;
$$;

revoke all on function public.tamaverse_create_diamond_giveaway(bigint,integer,timestamptz,text) from public, anon;
revoke all on function public.tamaverse_list_diamond_giveaways() from public, anon;
revoke all on function public.tamaverse_cancel_diamond_giveaway(uuid) from public, anon;
revoke all on function public.tamaverse_claim_diamond_giveaway(text) from public, anon;
grant execute on function public.tamaverse_create_diamond_giveaway(bigint,integer,timestamptz,text) to authenticated;
grant execute on function public.tamaverse_list_diamond_giveaways() to authenticated;
grant execute on function public.tamaverse_cancel_diamond_giveaway(uuid) to authenticated;
grant execute on function public.tamaverse_claim_diamond_giveaway(text) to authenticated;
