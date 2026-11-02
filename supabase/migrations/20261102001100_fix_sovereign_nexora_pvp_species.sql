-- Fix: allow the Founder-exclusive Sovereign Nexora in PvP matches.
-- Base stats match the canonical pet registry in script.js and founder injection in supabase.js.

CREATE OR REPLACE FUNCTION public.start_pvp_match(p_room_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_room public.pvp_rooms%rowtype;
  v_host_pet public.pets%rowtype;
  v_guest_pet public.pets%rowtype;
  v_host_base jsonb;
  v_guest_base jsonb;
  v_host_stats jsonb;
  v_guest_stats jsonb;
  v_host_data jsonb;
  v_guest_data jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Login required';
  END IF;

  SELECT * INTO v_room
  FROM public.pvp_rooms
  WHERE id = p_room_id
  FOR UPDATE;

  IF NOT FOUND
     OR v_room.host_id <> v_uid
     OR v_room.guest_id IS NULL
     OR v_room.status <> 'ready' THEN
    RAISE EXCEPTION 'Room belum siap atau kamu bukan host';
  END IF;

  -- Validate host pet against the database.
  SELECT * INTO v_host_pet
  FROM public.pets
  WHERE owner_id = v_room.host_id
    AND client_uid = v_room.host_data->>'pet_uid'
    AND is_active = true
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pet host tidak valid atau bukan pet aktif miliknya';
  END IF;

  -- Validate guest pet against the database.
  SELECT * INTO v_guest_pet
  FROM public.pets
  WHERE owner_id = v_room.guest_id
    AND client_uid = v_room.guest_data->>'pet_uid'
    AND is_active = true
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pet guest tidak valid atau bukan pet aktif miliknya';
  END IF;

  -- Server-authoritative base stats. Keep both sides in sync.
  v_host_base := CASE v_host_pet.species
    WHEN 'fluffin' THEN '{"hp":95,"atk":15,"def":12,"spd":16}'::jsonb
    WHEN 'embercub' THEN '{"hp":88,"atk":18,"def":10,"spd":17}'::jsonb
    WHEN 'bubblit' THEN '{"hp":105,"atk":13,"def":15,"spd":12}'::jsonb
    WHEN 'mossling' THEN '{"hp":100,"atk":14,"def":16,"spd":10}'::jsonb
    WHEN 'voltkit' THEN '{"hp":90,"atk":20,"def":11,"spd":20}'::jsonb
    WHEN 'coralyn' THEN '{"hp":110,"atk":17,"def":18,"spd":12}'::jsonb
    WHEN 'cinderowl' THEN '{"hp":96,"atk":19,"def":14,"spd":16}'::jsonb
    WHEN 'petalyn' THEN '{"hp":92,"atk":16,"def":13,"spd":21}'::jsonb
    WHEN 'lunabun' THEN '{"hp":110,"atk":20,"def":17,"spd":21}'::jsonb
    WHEN 'glacipup' THEN '{"hp":118,"atk":22,"def":18,"spd":14}'::jsonb
    WHEN 'starwhale' THEN '{"hp":128,"atk":23,"def":20,"spd":17}'::jsonb
    WHEN 'wyrmling' THEN '{"hp":116,"atk":24,"def":16,"spd":22}'::jsonb
    WHEN 'sovereign-nexora' THEN '{"hp":132,"atk":26,"def":23,"spd":19}'::jsonb
    ELSE NULL
  END;

  v_guest_base := CASE v_guest_pet.species
    WHEN 'fluffin' THEN '{"hp":95,"atk":15,"def":12,"spd":16}'::jsonb
    WHEN 'embercub' THEN '{"hp":88,"atk":18,"def":10,"spd":17}'::jsonb
    WHEN 'bubblit' THEN '{"hp":105,"atk":13,"def":15,"spd":12}'::jsonb
    WHEN 'mossling' THEN '{"hp":100,"atk":14,"def":16,"spd":10}'::jsonb
    WHEN 'voltkit' THEN '{"hp":90,"atk":20,"def":11,"spd":20}'::jsonb
    WHEN 'coralyn' THEN '{"hp":110,"atk":17,"def":18,"spd":12}'::jsonb
    WHEN 'cinderowl' THEN '{"hp":96,"atk":19,"def":14,"spd":16}'::jsonb
    WHEN 'petalyn' THEN '{"hp":92,"atk":16,"def":13,"spd":21}'::jsonb
    WHEN 'lunabun' THEN '{"hp":110,"atk":20,"def":17,"spd":21}'::jsonb
    WHEN 'glacipup' THEN '{"hp":118,"atk":22,"def":18,"spd":14}'::jsonb
    WHEN 'starwhale' THEN '{"hp":128,"atk":23,"def":20,"spd":17}'::jsonb
    WHEN 'wyrmling' THEN '{"hp":116,"atk":24,"def":16,"spd":22}'::jsonb
    WHEN 'sovereign-nexora' THEN '{"hp":132,"atk":26,"def":23,"spd":19}'::jsonb
    ELSE NULL
  END;

  IF v_host_base IS NULL OR v_guest_base IS NULL THEN
    RAISE EXCEPTION 'Species pet tidak dikenal';
  END IF;

  v_host_stats := jsonb_build_object(
    'hp', (v_host_base->>'hp')::int + 5 * (v_host_pet.level - 1),
    'atk', (v_host_base->>'atk')::int + (v_host_pet.level - 1),
    'def', (v_host_base->>'def')::int + (v_host_pet.level - 1),
    'spd', (v_host_base->>'spd')::int
  );

  v_guest_stats := jsonb_build_object(
    'hp', (v_guest_base->>'hp')::int + 5 * (v_guest_pet.level - 1),
    'atk', (v_guest_base->>'atk')::int + (v_guest_pet.level - 1),
    'def', (v_guest_base->>'def')::int + (v_guest_pet.level - 1),
    'spd', (v_guest_base->>'spd')::int
  );

  v_host_data := jsonb_build_object(
    'display_name', v_room.host_data->>'display_name',
    'pet_uid', v_host_pet.client_uid,
    'name', v_host_pet.nickname,
    'species', v_host_pet.species,
    'level', v_host_pet.level,
    'stats', v_host_stats
  );

  v_guest_data := jsonb_build_object(
    'display_name', v_room.guest_data->>'display_name',
    'pet_uid', v_guest_pet.client_uid,
    'name', v_guest_pet.nickname,
    'species', v_guest_pet.species,
    'level', v_guest_pet.level,
    'stats', v_guest_stats
  );

  UPDATE public.pvp_rooms
  SET
    host_data = v_host_data,
    guest_data = v_guest_data,
    status = 'playing',
    current_turn = host_id,
    battle_state = jsonb_build_object(
      'turn', 1,
      'host_hp', (v_host_stats->>'hp')::int,
      'guest_hp', (v_guest_stats->>'hp')::int
    )
  WHERE id = p_room_id
  RETURNING * INTO v_room;

  RETURN jsonb_build_object(
    'room_id', v_room.id,
    'status', v_room.status,
    'host_data', v_room.host_data,
    'guest_data', v_room.guest_data,
    'current_turn', v_room.current_turn,
    'battle_state', v_room.battle_state
  );
END;
$function$;
