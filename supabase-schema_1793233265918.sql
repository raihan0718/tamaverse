-- TAMAVERSE starter schema for Supabase
-- Run this in the Supabase SQL Editor.
-- This schema supports authenticated cloud saves; it does not make game rewards authoritative.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Penjelajah' check (char_length(display_name) between 1 and 18),
  avatar text not null default '🧙',
  level integer not null default 1 check (level >= 1),
  xp integer not null default 0 check (xp >= 0),
  rating integer not null default 1000 check (rating >= 0),
  wins integer not null default 0 check (wins >= 0),
  losses integer not null default 0 check (losses >= 0),
  draws integer not null default 0 check (draws >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.pets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  species text not null,
  nickname text not null check (char_length(nickname) between 1 and 18),
  level integer not null default 1 check (level >= 1),
  xp integer not null default 0 check (xp >= 0),
  hunger integer not null default 75 check (hunger between 0 and 100),
  happiness integer not null default 75 check (happiness between 0 and 100),
  energy integer not null default 80 check (energy between 0 and 100),
  cleanliness integer not null default 80 check (cleanliness between 0 and 100),
  evolution integer not null default 0 check (evolution between 0 and 100),
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index if not exists pets_one_active_per_owner
  on public.pets(owner_id) where is_active;
create index if not exists pets_owner_id_idx on public.pets(owner_id);

create table if not exists public.inventory (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  coins integer not null default 300 check (coins >= 0),
  gems integer not null default 3 check (gems >= 0),
  snack integer not null default 3 check (snack >= 0),
  energy integer not null default 2 check (energy >= 0),
  training integer not null default 1 check (training >= 0),
  fragments jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.daily_rewards (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  last_claim_date date,
  day smallint not null default 0 check (day between 0 and 7)
);

create table if not exists public.daily_quests (
  owner_id uuid not null references auth.users(id) on delete cascade,
  quest_date date not null default current_date,
  quest_id text not null,
  progress integer not null default 0 check (progress >= 0),
  claimed boolean not null default false,
  primary key (owner_id, quest_date, quest_id)
);

create table if not exists public.battle_history (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  mode text not null check (mode in ('practice', 'simulated')),
  result text not null check (result in ('win', 'loss', 'draw')),
  created_at timestamptz not null default now()
);
create index if not exists battle_history_owner_created_idx
  on public.battle_history(owner_id, created_at desc);

-- Create a profile and starter inventory when a new Supabase Auth account is registered.
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

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_tamaverse on auth.users;
create trigger on_auth_user_created_tamaverse
after insert on auth.users
for each row execute procedure public.create_tamaverse_player();

-- Backfill accounts that existed before this schema was installed.
insert into public.profiles (id)
select id from auth.users
on conflict (id) do nothing;
insert into public.inventory (owner_id)
select id from auth.users
on conflict (owner_id) do nothing;
insert into public.daily_rewards (owner_id)
select id from auth.users
on conflict (owner_id) do nothing;

alter table public.profiles enable row level security;
alter table public.pets enable row level security;
alter table public.inventory enable row level security;
alter table public.daily_rewards enable row level security;
alter table public.daily_quests enable row level security;
alter table public.battle_history enable row level security;

grant usage on schema public to authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.pets to authenticated;
grant select, update on public.inventory to authenticated;
grant select, update on public.daily_rewards to authenticated;
grant select, insert, update on public.daily_quests to authenticated;
grant select, insert on public.battle_history to authenticated;

-- Initial cloud-save policies: signed-in users can access only rows they own.
-- For competitive play, move currency, rewards, gacha, and battle result writes to trusted server functions.
drop policy if exists "Players can read own profile" on public.profiles;
create policy "Players can read own profile" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
drop policy if exists "Players can update own profile" on public.profiles;
create policy "Players can update own profile" on public.profiles
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

drop policy if exists "Players can read own pets" on public.pets;
create policy "Players can read own pets" on public.pets
  for select to authenticated using ((select auth.uid()) = owner_id);
drop policy if exists "Players can add own pets" on public.pets;
create policy "Players can add own pets" on public.pets
  for insert to authenticated with check ((select auth.uid()) = owner_id);
drop policy if exists "Players can update own pets" on public.pets;
create policy "Players can update own pets" on public.pets
  for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
drop policy if exists "Players can remove own pets" on public.pets;
create policy "Players can remove own pets" on public.pets
  for delete to authenticated using ((select auth.uid()) = owner_id);

drop policy if exists "Players can read own inventory" on public.inventory;
create policy "Players can read own inventory" on public.inventory
  for select to authenticated using ((select auth.uid()) = owner_id);
drop policy if exists "Players can update own inventory" on public.inventory;
create policy "Players can update own inventory" on public.inventory
  for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);

drop policy if exists "Players can read own daily rewards" on public.daily_rewards;
create policy "Players can read own daily rewards" on public.daily_rewards
  for select to authenticated using ((select auth.uid()) = owner_id);
drop policy if exists "Players can update own daily rewards" on public.daily_rewards;
create policy "Players can update own daily rewards" on public.daily_rewards
  for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);

drop policy if exists "Players can read own quests" on public.daily_quests;
create policy "Players can read own quests" on public.daily_quests
  for select to authenticated using ((select auth.uid()) = owner_id);
drop policy if exists "Players can add own quests" on public.daily_quests;
create policy "Players can add own quests" on public.daily_quests
  for insert to authenticated with check ((select auth.uid()) = owner_id);
drop policy if exists "Players can update own quests" on public.daily_quests;
create policy "Players can update own quests" on public.daily_quests
  for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);

drop policy if exists "Players can read own battle history" on public.battle_history;
create policy "Players can read own battle history" on public.battle_history
  for select to authenticated using ((select auth.uid()) = owner_id);
drop policy if exists "Players can add own battle history" on public.battle_history;
create policy "Players can add own battle history" on public.battle_history
  for insert to authenticated with check ((select auth.uid()) = owner_id);
