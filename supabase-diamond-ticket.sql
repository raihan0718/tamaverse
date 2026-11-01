-- Tamaverse Telegram payment tickets (manual QRIS verification)
-- Run after the base Tamaverse schema. Never expose the service-role key.

create table if not exists public.tamaverse_telegram_links (
  telegram_user_id text primary key,
  telegram_username text,
  owner_id uuid not null unique references auth.users(id) on delete cascade,
  linked_at timestamptz not null default now()
);

create table if not exists public.tamaverse_telegram_link_codes (
  code text primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.diamond_orders (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  telegram_user_id text not null,
  package_id text not null check (package_id in ('starter_50','popular_120','value_300','mega_700')),
  diamonds integer not null check (diamonds in (50,120,300,700)),
  amount_idr integer check (amount_idr is null or amount_idr > 0),
  status text not null default 'waiting_admin'
    check (status in ('waiting_admin','waiting_payment','proof_submitted','checking_payment','completed','cancelled')),
  proof_file_id text,
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  telegram_topic_id bigint
);
alter table public.diamond_orders
  add column if not exists telegram_topic_id bigint;
create index if not exists diamond_orders_owner_created_idx
  on public.diamond_orders(owner_id, created_at desc);
create index if not exists diamond_orders_status_created_idx
  on public.diamond_orders(status, created_at);

alter table public.tamaverse_telegram_links enable row level security;
alter table public.tamaverse_telegram_link_codes enable row level security;
alter table public.diamond_orders enable row level security;

drop policy if exists "Players read own diamond orders" on public.diamond_orders;
create policy "Players read own diamond orders" on public.diamond_orders
  for select to authenticated using ((select auth.uid()) = owner_id);

revoke all on public.tamaverse_telegram_links from anon, authenticated;
revoke all on public.tamaverse_telegram_link_codes from anon, authenticated;
revoke all on public.diamond_orders from anon, authenticated;
grant select on public.diamond_orders to authenticated;

create or replace function public.create_tamaverse_telegram_link_code()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_code text := upper(replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''));
begin
  if v_owner is null then raise exception 'AUTH_REQUIRED'; end if;
  delete from public.tamaverse_telegram_link_codes
    where owner_id = v_owner or expires_at < now();
  insert into public.tamaverse_telegram_link_codes(code, owner_id, expires_at)
    values (v_code, v_owner, now() + interval '10 minutes');
  return v_code;
end;
$$;
revoke all on function public.create_tamaverse_telegram_link_code() from public;
grant execute on function public.create_tamaverse_telegram_link_code() to authenticated;

create or replace function public.consume_tamaverse_telegram_link_code(
  p_code text, p_telegram_user_id text, p_telegram_username text default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_code public.tamaverse_telegram_link_codes%rowtype;
begin
  select * into v_code from public.tamaverse_telegram_link_codes
    where code = upper(trim(p_code)) and expires_at > now() for update;
  if not found then raise exception 'INVALID_OR_EXPIRED_CODE'; end if;
  if exists (select 1 from public.tamaverse_telegram_links where owner_id = v_code.owner_id and telegram_user_id <> p_telegram_user_id) then
    raise exception 'GAME_ACCOUNT_ALREADY_LINKED';
  end if;
  if exists (select 1 from public.tamaverse_telegram_links where telegram_user_id = p_telegram_user_id and owner_id <> v_code.owner_id) then
    raise exception 'TELEGRAM_ACCOUNT_ALREADY_LINKED';
  end if;
  insert into public.tamaverse_telegram_links(telegram_user_id, telegram_username, owner_id)
    values (p_telegram_user_id, nullif(p_telegram_username,''), v_code.owner_id)
    on conflict (telegram_user_id) do update
      set telegram_username = excluded.telegram_username, owner_id = excluded.owner_id;
  delete from public.tamaverse_telegram_link_codes where code = v_code.code;
  return jsonb_build_object('success', true, 'owner_id', v_code.owner_id);
end;
$$;
revoke all on function public.consume_tamaverse_telegram_link_code(text,text,text) from public, anon, authenticated;
grant execute on function public.consume_tamaverse_telegram_link_code(text,text,text) to service_role;

create or replace function public.create_tamaverse_diamond_order(
  p_telegram_user_id text, p_package_id text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
  v_diamonds integer;
  v_order public.diamond_orders%rowtype;
begin
  select owner_id into v_owner from public.tamaverse_telegram_links
    where telegram_user_id = p_telegram_user_id;
  if v_owner is null then raise exception 'TELEGRAM_NOT_LINKED'; end if;
  v_diamonds := case p_package_id
    when 'starter_50' then 50 when 'popular_120' then 120
    when 'value_300' then 300 when 'mega_700' then 700 else null end;
  if v_diamonds is null then raise exception 'INVALID_PACKAGE'; end if;
  insert into public.diamond_orders(owner_id, telegram_user_id, package_id, diamonds)
    values (v_owner, p_telegram_user_id, p_package_id, v_diamonds)
    returning * into v_order;
  return jsonb_build_object('id', v_order.id, 'diamonds', v_order.diamonds, 'status', v_order.status);
end;
$$;
revoke all on function public.create_tamaverse_diamond_order(text,text) from public, anon, authenticated;
grant execute on function public.create_tamaverse_diamond_order(text,text) to service_role;

create or replace function public.set_tamaverse_diamond_order_payment(
  p_order_id uuid, p_amount_idr integer, p_admin_note text default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_order public.diamond_orders%rowtype;
begin
  if p_amount_idr is null or p_amount_idr < 1 then raise exception 'INVALID_AMOUNT'; end if;
  update public.diamond_orders set amount_idr = p_amount_idr,
    admin_note = p_admin_note, status = 'waiting_payment', updated_at = now()
    where id = p_order_id and status = 'waiting_admin'
    returning * into v_order;
  if not found then raise exception 'ORDER_NOT_WAITING_ADMIN'; end if;
  return jsonb_build_object('id',v_order.id,'telegram_user_id',v_order.telegram_user_id,
    'diamonds',v_order.diamonds,'amount_idr',v_order.amount_idr,'status',v_order.status);
end;
$$;
revoke all on function public.set_tamaverse_diamond_order_payment(uuid,integer,text) from public, anon, authenticated;
grant execute on function public.set_tamaverse_diamond_order_payment(uuid,integer,text) to service_role;

create or replace function public.submit_tamaverse_diamond_proof(
  p_order_id uuid, p_telegram_user_id text, p_file_id text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_order public.diamond_orders%rowtype;
begin
  update public.diamond_orders set proof_file_id = p_file_id,
    status = 'proof_submitted', updated_at = now()
    where id = p_order_id and telegram_user_id = p_telegram_user_id
      and status = 'waiting_payment'
    returning * into v_order;
  if not found then raise exception 'ORDER_NOT_ACCEPTING_PROOF'; end if;
  return jsonb_build_object('id',v_order.id,'telegram_user_id',v_order.telegram_user_id,
    'diamonds',v_order.diamonds,'amount_idr',v_order.amount_idr,'status',v_order.status);
end;
$$;
revoke all on function public.submit_tamaverse_diamond_proof(uuid,text,text) from public, anon, authenticated;
grant execute on function public.submit_tamaverse_diamond_proof(uuid,text,text) to service_role;

create or replace function public.set_tamaverse_diamond_order_status(
  p_order_id uuid, p_status text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_order public.diamond_orders%rowtype;
begin
  if p_status not in ('checking_payment','cancelled') then raise exception 'INVALID_STATUS'; end if;
  update public.diamond_orders set status = p_status, updated_at = now()
    where id = p_order_id and status in ('proof_submitted','waiting_payment')
    returning * into v_order;
  if not found then raise exception 'ORDER_STATUS_CONFLICT'; end if;
  return jsonb_build_object('id',v_order.id,'telegram_user_id',v_order.telegram_user_id,
    'diamonds',v_order.diamonds,'amount_idr',v_order.amount_idr,'status',v_order.status);
end;
$$;
revoke all on function public.set_tamaverse_diamond_order_status(uuid,text) from public, anon, authenticated;
grant execute on function public.set_tamaverse_diamond_order_status(uuid,text) to service_role;

create or replace function public.approve_tamaverse_diamond_order(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_order public.diamond_orders%rowtype;
begin
  select * into v_order from public.diamond_orders where id = p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_order.status = 'completed' then
    return jsonb_build_object('success',true,'already_completed',true,
      'owner_id',v_order.owner_id,'diamonds',v_order.diamonds,'telegram_user_id',v_order.telegram_user_id);
  end if;
  if v_order.status not in ('proof_submitted','checking_payment') then
    raise exception 'ORDER_NOT_VERIFIED_OR_INVALID_STATUS';
  end if;
  update public.inventory set gems = gems + v_order.diamonds, updated_at = now()
    where owner_id = v_order.owner_id;
  if not found then raise exception 'PLAYER_INVENTORY_NOT_FOUND'; end if;
  update public.diamond_orders set status = 'completed', completed_at = now(), updated_at = now()
    where id = p_order_id;
  return jsonb_build_object('success',true,'already_completed',false,
    'owner_id',v_order.owner_id,'diamonds',v_order.diamonds,'telegram_user_id',v_order.telegram_user_id);
end;
$$;
revoke all on function public.approve_tamaverse_diamond_order(uuid) from public, anon, authenticated;
grant execute on function public.approve_tamaverse_diamond_order(uuid) to service_role;


-- Protect purchased Diamonds from direct client-side inventory updates.
-- SECURITY DEFINER game RPCs (owned by postgres) and service_role backend
-- operations can still change gems; authenticated table updates cannot.
create or replace function public.guard_tamaverse_gem_balance()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.gems is distinct from old.gems
     and current_user not in ('postgres', 'service_role', 'supabase_admin') then
    raise exception 'GEM_BALANCE_SERVER_CONTROLLED';
  end if;
  return new;
end;
$$;
drop trigger if exists tamaverse_guard_gem_balance on public.inventory;
create trigger tamaverse_guard_gem_balance
before update of gems on public.inventory
for each row execute function public.guard_tamaverse_gem_balance();


-- Fixed-price package migration
alter table public.diamond_orders drop constraint if exists diamond_orders_package_id_check;
alter table public.diamond_orders drop constraint if exists diamond_orders_diamonds_check;
alter table public.diamond_orders add constraint diamond_orders_package_id_check check (package_id in ('starter_50','popular_120','value_300','mega_700','mini_5','basic_10','plus_25','pro_50','max_100'));
alter table public.diamond_orders add constraint diamond_orders_diamonds_check check (diamonds in (5,10,25,50,100,120,300,700));
alter table public.diamond_orders add column if not exists payment_method text check (payment_method is null or payment_method in ('gopay','qris'));
create table if not exists public.tamaverse_payment_settings (key text primary key,value text not null,updated_at timestamptz not null default now());
alter table public.tamaverse_payment_settings enable row level security;
revoke all on public.tamaverse_payment_settings from anon,authenticated;
create or replace function public.create_tamaverse_diamond_order(p_telegram_user_id text,p_package_id text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_owner uuid; v_diamonds integer; v_order public.diamond_orders%rowtype;
begin
 select owner_id into v_owner from public.tamaverse_telegram_links where telegram_user_id=p_telegram_user_id;
 if v_owner is null then raise exception 'TELEGRAM_NOT_LINKED'; end if;
 v_diamonds := case p_package_id when 'mini_5' then 5 when 'basic_10' then 10 when 'plus_25' then 25 when 'pro_50' then 50 when 'max_100' then 100 else null end;
 if v_diamonds is null then raise exception 'INVALID_PACKAGE'; end if;
 insert into public.diamond_orders(owner_id,telegram_user_id,package_id,diamonds) values(v_owner,p_telegram_user_id,p_package_id,v_diamonds) returning * into v_order;
 return jsonb_build_object('id',v_order.id,'diamonds',v_order.diamonds,'status',v_order.status);
end;
$$;
revoke all on function public.create_tamaverse_diamond_order(text,text) from public,anon,authenticated;
grant execute on function public.create_tamaverse_diamond_order(text,text) to service_role;
