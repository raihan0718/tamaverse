-- TAMAVERSE: server-authoritative PvP battle engine
-- Apply after the pet_uid + validated start_pvp_match migrations.

CREATE OR REPLACE FUNCTION public.pvp_battle_action(
  p_room_id uuid,
  p_action text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_room public.pvp_rooms%rowtype;
  v_actor_is_host boolean;
  v_actor_data jsonb;
  v_target_data jsonb;
  v_actor_stats jsonb;
  v_target_stats jsonb;
  v_state jsonb;
  v_actor_hp integer;
  v_target_hp integer;
  v_actor_max_hp integer;
  v_target_max_hp integer;
  v_actor_atk numeric;
  v_actor_def numeric;
  v_target_atk numeric;
  v_target_def numeric;
  v_actor_element text;
  v_target_element text;
  v_damage integer := 0;
  v_incoming_multiplier numeric := 1;
  v_element_multiplier numeric := 1;
  v_random numeric;
  v_turn integer;
  v_skill_key text;
  v_defend_key text;
  v_actor_hp_key text;
  v_target_hp_key text;
  v_log jsonb;
  v_result text := NULL;
  v_winner uuid := NULL;
  v_actor_pet public.pets%rowtype;
  v_target_pet public.pets%rowtype;
  v_actor_xp integer := 0;
  v_target_xp integer := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Login required';
  END IF;

  IF p_action NOT IN ('attack', 'skill', 'defend', 'item') THEN
    RAISE EXCEPTION 'Aksi battle tidak valid';
  END IF;

  SELECT * INTO v_room
  FROM public.pvp_rooms
  WHERE id = p_room_id
  FOR UPDATE;

  IF NOT FOUND OR v_room.status <> 'playing' THEN
    RAISE EXCEPTION 'Battle tidak sedang berlangsung';
  END IF;

  IF v_room.host_id = v_uid THEN
    v_actor_is_host := true;
    v_actor_data := v_room.host_data;
    v_target_data := v_room.guest_data;
    v_actor_hp_key := 'host_hp';
    v_target_hp_key := 'guest_hp';
    v_skill_key := 'host_skill_used';
    v_defend_key := 'host_defending';
  ELSIF v_room.guest_id = v_uid THEN
    v_actor_is_host := false;
    v_actor_data := v_room.guest_data;
    v_target_data := v_room.host_data;
    v_actor_hp_key := 'guest_hp';
    v_target_hp_key := 'host_hp';
    v_skill_key := 'guest_skill_used';
    v_defend_key := 'guest_defending';
  ELSE
    RAISE EXCEPTION 'Kamu bukan peserta room ini';
  END IF;

  IF v_room.current_turn <> v_uid THEN
    RAISE EXCEPTION 'Belum giliranmu';
  END IF;

  v_actor_stats := v_actor_data->'stats';
  v_target_stats := v_target_data->'stats';
  v_state := COALESCE(v_room.battle_state, '{}'::jsonb);

  v_actor_hp := COALESCE((v_state->>v_actor_hp_key)::integer, 0);
  v_target_hp := COALESCE((v_state->>v_target_hp_key)::integer, 0);
  v_actor_max_hp := COALESCE((v_actor_stats->>'hp')::integer, 1);
  v_target_max_hp := COALESCE((v_target_stats->>'hp')::integer, 1);
  v_actor_atk := COALESCE((v_actor_stats->>'atk')::numeric, 1);
  v_actor_def := COALESCE((v_actor_stats->>'def')::numeric, 0);
  v_target_atk := COALESCE((v_target_stats->>'atk')::numeric, 1);
  v_target_def := COALESCE((v_target_stats->>'def')::numeric, 0);
  v_actor_element := COALESCE(v_actor_data->>'element', '');
  v_target_element := COALESCE(v_target_data->>'element', '');
  v_turn := COALESCE((v_state->>'turn')::integer, 1);
  v_log := COALESCE(v_state->'log', '[]'::jsonb);

  IF v_actor_hp <= 0 OR v_target_hp <= 0 THEN
    RAISE EXCEPTION 'Status HP battle tidak valid';
  END IF;

  IF p_action = 'skill' AND COALESCE((v_state->>v_skill_key)::boolean, false) THEN
    RAISE EXCEPTION 'Skill sudah digunakan pada battle ini';
  END IF;

  IF p_action = 'item' THEN
    UPDATE public.inventory
    SET snack = snack - 1, updated_at = now()
    WHERE owner_id = v_uid AND snack > 0;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Camilan habis';
    END IF;

    v_actor_hp := LEAST(v_actor_max_hp, v_actor_hp + 25);
    v_log := v_log || jsonb_build_array(
      jsonb_build_object('text', v_actor_data->>'name' || ' memakai camilan dan memulihkan HP.', 'action', 'item')
    );
  ELSIF p_action = 'defend' THEN
    v_state := jsonb_set(v_state, ARRAY[v_defend_key], 'true'::jsonb, true);
    v_log := v_log || jsonb_build_array(
      jsonb_build_object('text', v_actor_data->>'name' || ' bersiap bertahan.', 'action', 'defend')
    );
  ELSE
    IF v_actor_element = 'Fire' AND v_target_element = 'Nature'
      OR v_actor_element = 'Nature' AND v_target_element = 'Water'
      OR v_actor_element = 'Water' AND v_target_element = 'Fire'
      OR v_actor_element = 'Light' AND v_target_element = 'Fire' THEN
      v_element_multiplier := 1.25;
    ELSIF v_target_element = 'Fire' AND v_actor_element = 'Nature'
      OR v_target_element = 'Nature' AND v_actor_element = 'Water'
      OR v_target_element = 'Water' AND v_actor_element = 'Fire'
      OR v_target_element = 'Light' AND v_actor_element = 'Fire' THEN
      v_element_multiplier := 0.8;
    END IF;

    v_random := 0.85 + random() * 0.30;
    v_damage := GREATEST(4, round((v_actor_atk + CASE WHEN p_action = 'skill' THEN 10 ELSE 0 END - v_target_def * 0.35) * v_random * v_element_multiplier)::integer);

    IF random() < 0.10 THEN
      v_damage := round(v_damage * 1.5)::integer;
    END IF;

    v_target_hp := GREATEST(0, v_target_hp - v_damage);
    IF p_action = 'skill' THEN
      v_state := jsonb_set(v_state, ARRAY[v_skill_key], 'true'::jsonb, true);
    END IF;
    v_log := v_log || jsonb_build_array(
      jsonb_build_object(
        'text', v_actor_data->>'name' ||
          CASE WHEN p_action = 'skill' THEN ' menggunakan Skill dan memberi ' ELSE ' menyerang dan memberi ' END ||
          v_damage::text || ' damage!',
        'action', p_action,
        'damage', v_damage
      )
    );
  END IF;

  IF v_target_hp <= 0 THEN
    v_result := 'win';
    v_winner := v_uid;
  ELSE
    -- The defending flag belongs to the player receiving this action.
    IF v_actor_is_host THEN
      v_incoming_multiplier := CASE WHEN COALESCE((v_state->>'guest_defending')::boolean, false) THEN 0.45 ELSE 1 END;
      v_state := jsonb_set(v_state, '{guest_defending}', 'false'::jsonb, true);
    ELSE
      v_incoming_multiplier := CASE WHEN COALESCE((v_state->>'host_defending')::boolean, false) THEN 0.45 ELSE 1 END;
      v_state := jsonb_set(v_state, '{host_defending}', 'false'::jsonb, true);
    END IF;

    -- In PvP the opponent does not auto-attack. Defend protects against the next actual attack.
    -- The next player chooses their own action on their turn.
    IF v_actor_is_host THEN
      v_room.current_turn := v_room.guest_id;
    ELSE
      v_room.current_turn := v_room.host_id;
      v_turn := v_turn + 1;
    END IF;

    -- Preserve a defend stance until the opponent's attack is resolved.
    IF p_action = 'defend' THEN
      IF v_actor_is_host THEN
        v_state := jsonb_set(v_state, '{host_defending}', 'true'::jsonb, true);
      ELSE
        v_state := jsonb_set(v_state, '{guest_defending}', 'true'::jsonb, true);
      END IF;
    END IF;

    IF v_turn > 30 AND NOT v_actor_is_host THEN
      v_result := 'draw';
    END IF;
  END IF;

  v_state := jsonb_set(v_state, ARRAY[v_actor_hp_key], to_jsonb(v_actor_hp), true);
  v_state := jsonb_set(v_state, ARRAY[v_target_hp_key], to_jsonb(v_target_hp), true);
  v_state := jsonb_set(v_state, '{turn}', to_jsonb(v_turn), true);
  v_state := jsonb_set(v_state, '{log}', v_log, true);

  IF v_result IS NOT NULL THEN
    v_room.status := 'finished';
    v_state := jsonb_set(v_state, '{result}', to_jsonb(v_result), true);
    v_state := jsonb_set(v_state, '{winner_id}', COALESCE(to_jsonb(v_winner), 'null'::jsonb), true);

    IF v_room.host_id = v_winner THEN
      v_actor_pet := NULL;
    END IF;

    -- Apply competitive rewards exactly once, while holding the room row lock.
    IF v_result = 'draw' THEN
      UPDATE public.profiles SET draws = draws + 1 WHERE id IN (v_room.host_id, v_room.guest_id);
      INSERT INTO public.battle_history(owner_id, mode, result) VALUES
        (v_room.host_id, 'online', 'draw'),
        (v_room.guest_id, 'online', 'draw');
    ELSE
      UPDATE public.profiles
      SET wins = wins + CASE WHEN id = v_winner THEN 1 ELSE 0 END,
          losses = losses + CASE WHEN id <> v_winner THEN 1 ELSE 0 END,
          rating = GREATEST(0, rating + CASE WHEN id = v_winner THEN 5 ELSE -5 END)
      WHERE id IN (v_room.host_id, v_room.guest_id);

      INSERT INTO public.inventory(owner_id, coins)
      VALUES (v_winner, 35)
      ON CONFLICT (owner_id) DO UPDATE SET coins = public.inventory.coins + 35, updated_at = now();

      INSERT INTO public.battle_history(owner_id, mode, result) VALUES
        (v_room.host_id, 'online', CASE WHEN v_room.host_id = v_winner THEN 'win' ELSE 'loss' END),
        (v_room.guest_id, 'online', CASE WHEN v_room.guest_id = v_winner THEN 'win' ELSE 'loss' END);
    END IF;

    -- Pet XP is stored server-side; level-up thresholds match the local pet progression.
    UPDATE public.pets
    SET xp = xp + CASE
          WHEN owner_id = v_room.host_id THEN CASE WHEN v_room.host_id = v_winner THEN 20 ELSE 8 END
          ELSE CASE WHEN v_room.guest_id = v_winner THEN 20 ELSE 8 END
        END
    WHERE (owner_id = v_room.host_id AND client_uid = v_room.host_data->>'pet_uid')
       OR (owner_id = v_room.guest_id AND client_uid = v_room.guest_data->>'pet_uid');

    UPDATE public.pets p
    SET level = p.level + 1,
        xp = GREATEST(0, p.xp - (p.level * 40))
    WHERE p.id IN (
      SELECT id FROM public.pets
      WHERE (owner_id = v_room.host_id AND client_uid = v_room.host_data->>'pet_uid')
         OR (owner_id = v_room.guest_id AND client_uid = v_room.guest_data->>'pet_uid')
    )
      AND p.xp >= p.level * 40;

    -- Refresh cloud pet stats and keep the room snapshot consistent for the result screen.
    SELECT * INTO v_actor_pet
    FROM public.pets
    WHERE owner_id = v_room.host_id AND client_uid = v_room.host_data->>'pet_uid';

    SELECT * INTO v_target_pet
    FROM public.pets
    WHERE owner_id = v_room.guest_id AND client_uid = v_room.guest_data->>'pet_uid';

    v_state := jsonb_set(v_state, '{rewards_applied}', 'true'::jsonb, true);
  END IF;

  UPDATE public.pvp_rooms
  SET status = v_room.status,
      current_turn = CASE WHEN v_result IS NULL THEN v_room.current_turn ELSE NULL END,
      battle_state = v_state
  WHERE id = p_room_id
  RETURNING * INTO v_room;

  RETURN jsonb_build_object(
    'room_id', v_room.id,
    'status', v_room.status,
    'host_id', v_room.host_id,
    'guest_id', v_room.guest_id,
    'host_data', v_room.host_data,
    'guest_data', v_room.guest_data,
    'current_turn', v_room.current_turn,
    'battle_state', v_room.battle_state
  );
END;
$function$;

REVOKE UPDATE ON public.pvp_rooms FROM authenticated;
GRANT EXECUTE ON FUNCTION public.pvp_battle_action(uuid, text) TO authenticated;
