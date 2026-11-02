-- One-time 100 Diamond welcome bonus for accounts created during the
-- ten-day launch campaign (Jakarta time: Nov 2 through Nov 11, 2026).
create table if not exists public.tamaverse_new_player_bonus_claims (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  amount integer not null default 100 check (amount = 100),
  claimed_at timestamptz not null default now()
);

alter table public.tamaverse_new_player_bonus_claims enable row level security;
revoke all on public.tamaverse_new_player_bonus_claims from public, anon, authenticated;

create or replace function public.tamaverse_claim_new_player_bonus()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_created_at timestamptz;
  v_claimed_owner uuid;
  v_balance bigint;
  v_start timestamptz := timestamptz '2026-11-02 00:00:00+07';
  v_end timestamptz := timestamptz '2026-11-12 00:00:00+07';
begin
  if v_owner is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select created_at into v_created_at
  from auth.users
  where id = v_owner;

  if v_created_at is null or v_created_at < v_start or v_created_at >= v_end then
    return jsonb_build_object('success', false, 'eligible', false);
  end if;

  insert into public.tamaverse_new_player_bonus_claims (owner_id, amount)
  values (v_owner, 100)
  on conflict (owner_id) do nothing
  returning owner_id into v_claimed_owner;

  if v_claimed_owner is null then
    select diamonds into v_balance
    from public.inventory
    where owner_id = v_owner;
    return jsonb_build_object(
      'success', false,
      'eligible', true,
      'already_claimed', true,
      'diamonds', coalesce(v_balance, 0)
    );
  end if;

  update public.inventory
  set diamonds = diamonds + 100,
      updated_at = now()
  where owner_id = v_owner
  returning diamonds into v_balance;

  if v_balance is null then
    raise exception 'PLAYER_INVENTORY_NOT_FOUND';
  end if;

  return jsonb_build_object(
    'success', true,
    'eligible', true,
    'already_claimed', false,
    'bonus', 100,
    'diamonds', v_balance
  );
end;
$$;

revoke all on function public.tamaverse_claim_new_player_bonus() from public, anon;
grant execute on function public.tamaverse_claim_new_player_bonus() to authenticated;
