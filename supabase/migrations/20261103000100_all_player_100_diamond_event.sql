-- Tamaverse 100 Diamond event: every authenticated player may claim once
-- during the campaign window (Jakarta time: Nov 2 through Nov 11, 2026).
-- Existing claim rows from the new-player campaign remain valid and prevent
-- duplicate grants to accounts that already received the welcome bonus.
-- Ensure the claim ledger exists even when the earlier welcome-bonus
-- migration was not applied independently.
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
  v_claimed_owner uuid;
  v_balance bigint;
  v_start timestamptz := timestamptz '2026-11-02 00:00:00+07';
  v_end timestamptz := timestamptz '2026-11-12 00:00:00+07';
begin
  if v_owner is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if now() < v_start or now() >= v_end then
    return jsonb_build_object('success', false, 'eligible', false, 'event_ended', now() >= v_end);
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
