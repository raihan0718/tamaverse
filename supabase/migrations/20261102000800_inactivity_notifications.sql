alter table public.tamaverse_telegram_links
  add column if not exists last_login_at timestamptz;

create table if not exists public.tamaverse_inactivity_notification_state (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  last_sent_at timestamptz
);
alter table public.tamaverse_inactivity_notification_state enable row level security;
revoke all on public.tamaverse_inactivity_notification_state from anon, authenticated;

create or replace function public.claim_tamaverse_inactivity_notification(p_owner_id uuid)
returns boolean language plpgsql security definer set search_path = ''
as $$
begin
  if p_owner_id is null then return false; end if;
  insert into public.tamaverse_inactivity_notification_state(owner_id, last_sent_at)
  values (p_owner_id, null) on conflict (owner_id) do nothing;
  update public.tamaverse_inactivity_notification_state
  set last_sent_at = now()
  where owner_id = p_owner_id
    and (last_sent_at is null or last_sent_at <= now() - interval '24 hours');
  return found;
end;
$$;

revoke all on function public.claim_tamaverse_inactivity_notification(uuid) from public, anon, authenticated;
grant execute on function public.claim_tamaverse_inactivity_notification(uuid) to service_role;
