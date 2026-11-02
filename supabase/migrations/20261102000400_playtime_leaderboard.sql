-- Tamaverse active playtime + secure leaderboard counter
alter table public.profiles
  add column if not exists playtime_seconds bigint not null default 0
  check (playtime_seconds >= 0);

create or replace function public.add_tamaverse_playtime(p_seconds integer)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total bigint;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;
  if p_seconds is null or p_seconds < 1 or p_seconds > 90 then
    raise exception 'INVALID_PLAYTIME_INCREMENT';
  end if;

  update public.profiles
     set playtime_seconds = coalesce(playtime_seconds, 0) + p_seconds
   where id = auth.uid()
  returning playtime_seconds into v_total;

  if not found then
    raise exception 'PROFILE_NOT_FOUND';
  end if;
  return v_total;
end;
$$;

revoke all on function public.add_tamaverse_playtime(integer) from public;
grant execute on function public.add_tamaverse_playtime(integer) to authenticated;
