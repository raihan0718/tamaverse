-- Tamaverse shared player avatars
-- Run this migration in the Supabase SQL Editor.

alter table public.profiles
  add column if not exists avatar_url text;

-- Public bucket so avatars can be rendered by other players and on public ranking cards.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'player-avatars',
  'player-avatars',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Anyone may read avatar objects because the bucket is intentionally public.
drop policy if exists "Player avatars are publicly readable" on storage.objects;
create policy "Player avatars are publicly readable"
  on storage.objects
  for select
  to public
  using (bucket_id = 'player-avatars');

-- Authenticated players may upload only inside their own UUID folder.
drop policy if exists "Players can upload own avatar" on storage.objects;
create policy "Players can upload own avatar"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'player-avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Players can update own avatar" on storage.objects;
create policy "Players can update own avatar"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'player-avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'player-avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Players can delete own avatar" on storage.objects;
create policy "Players can delete own avatar"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'player-avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

comment on column public.profiles.avatar_url is
  'Public Supabase Storage URL for the player avatar; avatar remains as the fallback emoji/legacy field.';
