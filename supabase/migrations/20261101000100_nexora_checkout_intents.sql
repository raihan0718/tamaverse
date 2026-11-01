-- NEXORA • checkout intent dari Mini App → bot (additive, jalankan SETELAH 20261101000000)

-- Asal pesanan: 'bot' (menu bot) atau 'miniapp' (checkout game)
alter table public.nexora_orders
  add column if not exists source text not null default 'bot';

create table if not exists public.nexora_checkout_intents (
  token      text primary key check (token ~ '^[A-Za-z0-9_-]{16,64}$'),
  owner_id   uuid not null,                       -- diverifikasi server dari JWT Supabase
  diamonds   integer not null check (diamonds > 0),
  price      integer not null check (price > 0),  -- snapshot untuk audit; bot memakai harga katalog
  method     text not null check (method in ('QRIS','GOPAY')),
  expires_at timestamptz not null,
  claimed_by text,                                -- Telegram user id yang membuka link
  claimed_at timestamptz,
  order_id   uuid references public.nexora_orders(id),
  created_at timestamptz not null default now()
);

create index if not exists nexora_checkout_intents_owner_idx
  on public.nexora_checkout_intents (owner_id, created_at desc);

alter table public.nexora_checkout_intents enable row level security;
revoke all on public.nexora_checkout_intents from anon, authenticated;
