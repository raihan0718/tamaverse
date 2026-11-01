-- NEXORA • TAMAVERSE — order, tiket, ledger Diamond (SANDBOX)
-- Additive only: tidak menghapus / mengubah tabel lama.
-- Asumsi tabel lama: public.tamaverse_telegram_links(telegram_user_id, telegram_username, owner_id)

-- ============================================================
-- 0. WALLET DIAMOND
-- Diamond top-up terpisah dari gems dan disimpan pada inventory.
-- Nilai hanya boleh diubah oleh fungsi server yang aman.
-- ============================================================
alter table public.inventory
  add column if not exists diamonds bigint not null default 0
  check (diamonds >= 0);

create or replace function public.guard_tamaverse_diamond_balance()
returns trigger
language plpgsql
security invoker
set search_path = public
as $
begin
  if current_user not in ('postgres', 'service_role', 'supabase_admin') then
    if tg_op = 'INSERT' and coalesce(new.diamonds, 0) <> 0 then
      raise exception 'DIAMOND_BALANCE_SERVER_CONTROLLED';
    end if;
    if tg_op = 'UPDATE' and new.diamonds is distinct from old.diamonds then
      raise exception 'DIAMOND_BALANCE_SERVER_CONTROLLED';
    end if;
  end if;
  return new;
end;
$;

drop trigger if exists tamaverse_guard_diamond_balance on public.inventory;
create trigger tamaverse_guard_diamond_balance
before insert or update of diamonds on public.inventory
for each row execute function public.guard_tamaverse_diamond_balance();

-- ============================================================
-- 1. TABEL
-- ============================================================
create table if not exists public.nexora_orders (
  id                   uuid primary key default gen_random_uuid(),
  order_code           text not null unique,
  telegram_user_id     text not null,
  telegram_chat_id     bigint not null,
  telegram_username    text,
  owner_id             uuid not null,
  diamonds             integer not null check (diamonds > 0),
  price                integer not null check (price > 0),
  payment_method       text check (payment_method in ('QRIS','GOPAY')),
  status               text not null default 'PENDING' check (status in
                         ('PENDING','WAITING_ADMIN','WAITING_PAYMENT','PROOF_SUBMITTED',
                          'APPROVED','DECLINED','CANCELLED','EXPIRED')),
  forum_chat_id        bigint,
  topic_thread_id      bigint,
  admin_message_id     bigint,
  proof_file_id        text,
  proof_file_unique_id text,
  proof_meta           jsonb,
  proof_submitted_at   timestamptz,
  decline_reason       text,
  last_actor           text,
  last_note            text,
  expires_at           timestamptz not null,
  decided_at           timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- Satu pesanan aktif per user (mencegah pesanan ganda dari tap berulang)
create unique index if not exists nexora_one_active_per_user
  on public.nexora_orders (telegram_user_id)
  where status in ('PENDING','WAITING_ADMIN','WAITING_PAYMENT','PROOF_SUBMITTED');

-- Satu topik hanya boleh milik satu pesanan
create unique index if not exists nexora_topic_unique
  on public.nexora_orders (forum_chat_id, topic_thread_id)
  where topic_thread_id is not null;

create index if not exists nexora_orders_user_idx
  on public.nexora_orders (telegram_user_id, created_at desc);
create index if not exists nexora_orders_proof_uid_idx
  on public.nexora_orders (proof_file_unique_id)
  where proof_file_unique_id is not null;

create table if not exists public.nexora_order_events (
  id          bigserial primary key,
  order_id    uuid not null references public.nexora_orders(id) on delete cascade,
  from_status text,
  to_status   text not null,
  actor       text,
  note        text,
  created_at  timestamptz not null default now()
);
create index if not exists nexora_order_events_order_idx
  on public.nexora_order_events (order_id, created_at);

create table if not exists public.nexora_diamond_ledger (
  id            bigserial primary key,
  owner_id      uuid not null,
  order_id      uuid not null unique references public.nexora_orders(id),  -- 1 order = 1 kredit
  delta         integer not null,
  balance_after bigint not null,
  reason        text not null default 'nexora_order_approved',
  created_at    timestamptz not null default now()
);

create table if not exists public.nexora_processed_updates (
  update_id  bigint primary key,
  created_at timestamptz not null default now()
);

-- ============================================================
-- 2. GUARD PERPINDAHAN STATUS + RIWAYAT STATUS (trigger)
-- ============================================================
create or replace function public.nexora_guard_status()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from old.status then
    if not (
      (old.status = 'PENDING'         and new.status in ('WAITING_ADMIN','CANCELLED','EXPIRED')) or
      (old.status = 'WAITING_ADMIN'   and new.status in ('WAITING_PAYMENT','CANCELLED','EXPIRED')) or
      (old.status = 'WAITING_PAYMENT' and new.status in ('PROOF_SUBMITTED','CANCELLED','EXPIRED')) or
      (old.status = 'PROOF_SUBMITTED' and new.status in ('APPROVED','DECLINED'))
    ) then
      raise exception 'invalid status transition % -> %', old.status, new.status;
    end if;

    insert into public.nexora_order_events (order_id, from_status, to_status, actor, note)
    values (new.id, old.status, new.status, new.last_actor, new.last_note);
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists nexora_orders_guard on public.nexora_orders;
create trigger nexora_orders_guard
  before update on public.nexora_orders
  for each row execute function public.nexora_guard_status();

-- ============================================================
-- 3. FUNGSI (dipanggil bot via service_role)
-- ============================================================

-- Compare-and-swap status. Mengembalikan baris order (jsonb) atau NULL bila
-- status saat ini tidak ada di p_from (berarti sudah diproses / tombol basi).
create or replace function public.nexora_transition(
  p_code  text,
  p_from  text[],
  p_to    text,
  p_actor text,
  p_note  text  default null,
  p_extra jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  o public.nexora_orders;
begin
  update public.nexora_orders set
    status               = p_to,
    last_actor           = p_actor,
    last_note            = p_note,
    payment_method       = coalesce(p_extra->>'payment_method', payment_method),
    proof_file_id        = coalesce(p_extra->>'proof_file_id', proof_file_id),
    proof_file_unique_id = coalesce(p_extra->>'proof_file_unique_id', proof_file_unique_id),
    proof_meta           = coalesce(p_extra->'proof_meta', proof_meta),
    proof_submitted_at   = case when p_to = 'PROOF_SUBMITTED' then now() else proof_submitted_at end,
    decline_reason       = case when p_to = 'DECLINED' then p_note else decline_reason end,
    decided_at           = case when p_to in ('DECLINED','CANCELLED','EXPIRED') then now() else decided_at end
  where order_code = p_code
    and status = any (p_from)
  returning * into o;

  if not found then
    return null;
  end if;
  return to_jsonb(o);
end;
$$;

-- Approve + kredit Diamond dalam SATU transaksi (atomik, idempoten).
create or replace function public.nexora_approve_order(p_code text, p_actor text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  o   public.nexora_orders;
  bal bigint;
begin
  select * into o from public.nexora_orders where order_code = p_code for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  if o.status <> 'PROOF_SUBMITTED' then
    return jsonb_build_object('ok', false, 'error', 'invalid_status', 'status', o.status);
  end if;

  if exists (select 1 from public.nexora_diamond_ledger where order_id = o.id) then
    return jsonb_build_object('ok', false, 'error', 'already_credited');
  end if;

  -- kepemilikan akun: UUID order harus masih terhubung ke Telegram user yang sama
  if not exists (
    select 1 from public.tamaverse_telegram_links l
    where l.telegram_user_id::text = o.telegram_user_id
      and l.owner_id::text = o.owner_id::text
  ) then
    return jsonb_build_object('ok', false, 'error', 'link_mismatch');
  end if;

  -- ===== KREDIT DIAMOND TOP-UP KE INVENTORY TAMAVERSE =====
  insert into public.inventory as i (owner_id, diamonds)
  values (o.owner_id, o.diamonds)
  on conflict (owner_id) do update
    set diamonds = i.diamonds + excluded.diamonds
  returning i.diamonds into bal;
  -- =========================================================

  insert into public.nexora_diamond_ledger (owner_id, order_id, delta, balance_after)
  values (o.owner_id, o.id, o.diamonds, bal);

  update public.nexora_orders
     set status = 'APPROVED', last_actor = p_actor, last_note = 'approved', decided_at = now()
   where id = o.id;

  return jsonb_build_object('ok', true, 'balance_after', bal, 'diamonds', o.diamonds);
end;
$$;

-- Kedaluwarsakan pesanan yang melewati expires_at (PROOF_SUBMITTED tidak ikut,
-- karena sedang diperiksa admin). Mengembalikan array order yang baru expired.
create or replace function public.nexora_expire_stale()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r jsonb;
begin
  with u as (
    update public.nexora_orders
       set status = 'EXPIRED', last_actor = 'system', last_note = 'ttl', decided_at = now()
     where status in ('PENDING','WAITING_ADMIN','WAITING_PAYMENT')
       and expires_at < now()
    returning *
  )
  select coalesce(jsonb_agg(to_jsonb(u)), '[]'::jsonb) into r from u;
  return r;
end;
$$;

-- ============================================================
-- 4. KEAMANAN: hanya service_role (Edge Function) yang boleh akses
-- ============================================================
alter table public.nexora_orders            enable row level security;
alter table public.nexora_order_events      enable row level security;
alter table public.nexora_diamond_ledger    enable row level security;
alter table public.nexora_processed_updates enable row level security;
-- Saldo Diamond dilindungi trigger dan hanya dikredit oleh fungsi approval server.

revoke all on public.nexora_orders, public.nexora_order_events,
              public.nexora_diamond_ledger, public.nexora_processed_updates
  from anon, authenticated;

revoke all on function public.nexora_transition(text, text[], text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.nexora_approve_order(text, text) from public, anon, authenticated;
revoke all on function public.nexora_expire_stale()            from public, anon, authenticated;
grant execute on function public.nexora_transition(text, text[], text, text, text, jsonb) to service_role;
grant execute on function public.nexora_approve_order(text, text) to service_role;
grant execute on function public.nexora_expire_stale()            to service_role;
