-- Tamaverse Diamond package RPC synchronization
-- Run this once in Supabase SQL Editor after the package_id constraint includes
-- starter_50, popular_120, value_300, mega_700, mini_5, basic_10,
-- plus_25, pro_50, and max_100.

create or replace function public.create_tamaverse_diamond_order(
  p_telegram_user_id text,
  p_package_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
  v_diamonds integer;
  v_order public.diamond_orders%rowtype;
begin
  select owner_id into v_owner
  from public.tamaverse_telegram_links
  where telegram_user_id = p_telegram_user_id;

  if v_owner is null then
    raise exception 'TELEGRAM_NOT_LINKED';
  end if;

  v_diamonds := case p_package_id
    when 'starter_50' then 50
    when 'popular_120' then 120
    when 'value_300' then 300
    when 'mega_700' then 700
    when 'mini_5' then 5
    when 'basic_10' then 10
    when 'plus_25' then 25
    when 'pro_50' then 50
    when 'max_100' then 100
    else null
  end;

  if v_diamonds is null then
    raise exception 'INVALID_PACKAGE';
  end if;

  insert into public.diamond_orders(owner_id, telegram_user_id, package_id, diamonds)
  values (v_owner, p_telegram_user_id, p_package_id, v_diamonds)
  returning * into v_order;

  return jsonb_build_object(
    'id', v_order.id,
    'diamonds', v_order.diamonds,
    'status', v_order.status
  );
end;
$$;

revoke all on function public.create_tamaverse_diamond_order(text,text)
  from public, anon, authenticated;
grant execute on function public.create_tamaverse_diamond_order(text,text)
  to service_role;

-- Quick verification of the deployed function's package mapping:
select p_package_id,
       case p_package_id
         when 'starter_50' then 50
         when 'popular_120' then 120
         when 'value_300' then 300
         when 'mega_700' then 700
         when 'mini_5' then 5
         when 'basic_10' then 10
         when 'plus_25' then 25
         when 'pro_50' then 50
         when 'max_100' then 100
       end as diamonds
from unnest(array[
  'starter_50','popular_120','value_300','mega_700',
  'mini_5','basic_10','plus_25','pro_50','max_100'
]::text[]) as p(p_package_id);
