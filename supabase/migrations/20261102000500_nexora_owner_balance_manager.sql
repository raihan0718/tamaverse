-- NEXORA owner-only manual wallet manager + immutable audit trail.
create table if not exists public.nexora_balance_logs (
  id bigserial primary key,
  actor_telegram_id text not null,
  target_telegram_id text not null,
  target_username text,
  owner_id uuid not null references auth.users(id),
  currency text not null check (currency in ('diamond','coin')),
  operation text not null check (operation in ('add','remove')),
  amount bigint not null check (amount > 0),
  balance_before bigint not null check (balance_before >= 0),
  balance_after bigint not null check (balance_after >= 0),
  reason text not null,
  created_at timestamptz not null default now()
);
create index if not exists nexora_balance_logs_created_idx on public.nexora_balance_logs(created_at desc);
alter table public.nexora_balance_logs enable row level security;
revoke all on public.nexora_balance_logs from public, anon, authenticated;

create table if not exists public.nexora_bot_settings (
  key text primary key, value text not null, updated_at timestamptz not null default now()
);
alter table public.nexora_bot_settings enable row level security;
revoke all on public.nexora_bot_settings from public, anon, authenticated;

create table if not exists public.nexora_admin_sessions (
  telegram_user_id text primary key, session jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.nexora_admin_sessions enable row level security;
revoke all on public.nexora_admin_sessions from public, anon, authenticated;

create or replace function public.nexora_owner_adjust_balance(
  p_actor_telegram_id text, p_owner_telegram_id text, p_currency text,
  p_operation text, p_amount bigint, p_reason text
) returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_owner uuid; v_username text; v_before bigint; v_after bigint;
begin
  if p_actor_telegram_id is distinct from '8906658395' then raise exception 'OWNER_ONLY'; end if;
  if p_currency not in ('diamond','coin') or p_operation not in ('add','remove')
     or p_amount is null or p_amount < 1 or p_amount > 1000000000 then
    raise exception 'INVALID_ADJUSTMENT';
  end if;
  if length(trim(coalesce(p_reason,''))) < 3 or length(p_reason) > 300 then raise exception 'INVALID_REASON'; end if;
  select l.owner_id, l.telegram_username into v_owner, v_username
    from public.tamaverse_telegram_links l where l.telegram_user_id = p_owner_telegram_id for update;
  if v_owner is null then raise exception 'TARGET_NOT_LINKED'; end if;
  insert into public.inventory(owner_id) values (v_owner) on conflict (owner_id) do nothing;
  if p_currency = 'diamond' then
    select diamonds into v_before from public.inventory where owner_id = v_owner for update;
  else
    select coins into v_before from public.inventory where owner_id = v_owner for update;
  end if;
  v_after := case when p_operation = 'add' then v_before + p_amount else v_before - p_amount end;
  if v_after < 0 then raise exception 'INSUFFICIENT_BALANCE'; end if;
  if p_currency = 'diamond' then
    update public.inventory set diamonds = v_after, updated_at = now() where owner_id = v_owner;
  else
    update public.inventory set coins = v_after, updated_at = now() where owner_id = v_owner;
  end if;
  insert into public.nexora_balance_logs(
    actor_telegram_id,target_telegram_id,target_username,owner_id,currency,
    operation,amount,balance_before,balance_after,reason
  ) values (p_actor_telegram_id,p_owner_telegram_id,v_username,v_owner,p_currency,
    p_operation,p_amount,v_before,v_after,trim(p_reason));
  return jsonb_build_object('owner_id',v_owner,'telegram_user_id',p_owner_telegram_id,
    'username',v_username,'currency',p_currency,'operation',p_operation,'amount',p_amount,
    'balance_before',v_before,'balance_after',v_after,'reason',trim(p_reason));
end;
$$;
revoke all on function public.nexora_owner_adjust_balance(text,text,text,text,bigint,text) from public, anon, authenticated;
grant execute on function public.nexora_owner_adjust_balance(text,text,text,text,bigint,text) to service_role;
