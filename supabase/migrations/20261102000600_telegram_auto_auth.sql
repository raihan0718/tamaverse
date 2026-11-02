-- Ensure the Telegram identity map exists for automatic Mini App authentication.
-- Existing payment linking uses this same table, so linked accounts are preserved.
create table if not exists public.tamaverse_telegram_links (
  telegram_user_id text primary key,
  telegram_username text,
  owner_id uuid not null unique references auth.users(id) on delete cascade,
  linked_at timestamptz not null default now()
);

create index if not exists tamaverse_telegram_links_owner_id_idx
  on public.tamaverse_telegram_links(owner_id);

alter table public.tamaverse_telegram_links enable row level security;
revoke all on public.tamaverse_telegram_links from anon, authenticated;
