-- TAMAVERSE: stable cloud identity for every pet.
-- The client saves pets with ON CONFLICT (owner_id, client_uid), and PvP
-- matchmaking validates the same client_uid. Older schema snapshots lacked it.

ALTER TABLE public.pets
  ADD COLUMN IF NOT EXISTS client_uid text;

UPDATE public.pets
SET client_uid = id::text
WHERE client_uid IS NULL OR btrim(client_uid) = '';

ALTER TABLE public.pets
  ALTER COLUMN client_uid SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS pets_owner_client_uid_uidx
  ON public.pets(owner_id, client_uid);

-- The UI allows longer names than the original database constraint.
-- Normalize legacy values, then keep the DB limit aligned with the client.
UPDATE public.pets
SET nickname = left(btrim(nickname), 18)
WHERE char_length(nickname) > 18 OR btrim(nickname) = '';

ALTER TABLE public.pets
  DROP CONSTRAINT IF EXISTS pets_nickname_length_check;

ALTER TABLE public.pets
  ADD CONSTRAINT pets_nickname_length_check
  CHECK (char_length(nickname) BETWEEN 1 AND 18);

-- Preserve exactly one active pet per owner. Keep the most recently created
-- active row if old data contains duplicates before recreating the index.
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY owner_id
           ORDER BY created_at DESC NULLS LAST, id DESC
         ) AS position
  FROM public.pets
  WHERE is_active = true
)
UPDATE public.pets p
SET is_active = false
FROM ranked r
WHERE p.id = r.id AND r.position > 1;

CREATE UNIQUE INDEX IF NOT EXISTS pets_one_active_per_owner
  ON public.pets(owner_id)
  WHERE is_active = true;
