-- Harden the unified Diamond wallet and reward claims.
-- Safe to run after the original starter schema and Nexora migrations.

-- Recreate the Diamond guard with an explicit server-only balance rule.
create or replace function public.guard_tamaverse_diamond_balance()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
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
$$;

drop trigger if exists tamaverse_guard_diamond_balance on public.inventory;
create trigger tamaverse_guard_diamond_balance
before insert or update of diamonds on public.inventory
for each row execute function public.guard_tamaverse_diamond_balance();

-- Daily claim timestamps can only be changed by the SECURITY DEFINER claim RPC.
drop policy if exists "Players can update own daily rewards" on public.daily_rewards;
revoke update on public.daily_rewards from anon, authenticated;
grant select on public.daily_rewards to authenticated;

-- Fragment counts are currently saved by the client and are not trusted enough
-- to mint premium currency. Disable the old exchange RPC even if it was deployed.
drop function if exists public.tamaverse_exchange_fragments_for_diamond(text);

-- Revoke any accidental broad execution grants; keep only intended authenticated RPCs.
revoke all on function public.tamaverse_spend_diamonds(integer, text)
  from public, anon;
grant execute on function public.tamaverse_spend_diamonds(integer, text)
  to authenticated;
revoke all on function public.tamaverse_claim_daily_reward()
  from public, anon;
grant execute on function public.tamaverse_claim_daily_reward()
  to authenticated;
revoke all on function public.purchase_tamaverse_premium_item(text)
  from public, anon;
grant execute on function public.purchase_tamaverse_premium_item(text)
  to authenticated;
