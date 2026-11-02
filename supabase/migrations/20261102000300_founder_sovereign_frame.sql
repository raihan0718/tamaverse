-- Founder-only Nexora pet and Royal Sovereign frame.
-- Idempotent and safe to re-run.
alter table public.premium_inventory
  drop constraint if exists premium_frames_valid;

alter table public.premium_inventory
  add constraint premium_frames_valid
  check (
    owned_frames <@ array['common','uncommon','rare','legendary','celestial','royal-sovereign']::text[]
  );
