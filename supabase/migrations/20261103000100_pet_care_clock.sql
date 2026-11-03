-- Persist the active pet's care clock so offline decay is calculated from the last real update.
ALTER TABLE public.pets
  ADD COLUMN IF NOT EXISTS care_updated_at timestamptz NOT NULL DEFAULT now();
