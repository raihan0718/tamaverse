-- Securely consume one rename card from the authenticated player's premium inventory.
create or replace function public.consume_tamaverse_rename_card(p_card_type text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_premium public.premium_inventory%rowtype;
begin
  if v_owner is null then raise exception 'AUTH_REQUIRED'; end if;

  select * into v_premium
  from public.premium_inventory
  where owner_id = v_owner
  for update;

  if not found then raise exception 'PREMIUM_INVENTORY_NOT_FOUND'; end if;

  if p_card_type = 'rename' then
    if v_premium.rename_card_count < 1 then raise exception 'NO_RENAME_CARD'; end if;
    update public.premium_inventory
    set rename_card_count = rename_card_count - 1, updated_at = now()
    where owner_id = v_owner returning * into v_premium;
  elsif p_card_type = 'rename_pet' then
    if v_premium.rename_pet_card_count < 1 then raise exception 'NO_RENAME_PET_CARD'; end if;
    update public.premium_inventory
    set rename_pet_card_count = rename_pet_card_count - 1, updated_at = now()
    where owner_id = v_owner returning * into v_premium;
  else
    raise exception 'INVALID_CARD_TYPE';
  end if;

  return jsonb_build_object(
    'success', true,
    'rename_card_count', v_premium.rename_card_count,
    'rename_pet_card_count', v_premium.rename_pet_card_count
  );
end;
$$;

revoke all on function public.consume_tamaverse_rename_card(text) from public, anon;
grant execute on function public.consume_tamaverse_rename_card(text) to authenticated;
