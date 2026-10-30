-- ═══════════════════════════════════════════════════════════════════════════
-- Hidden profiles publish no location (run in the Supabase SQL editor)
--
-- Problem: profiles is publicly readable. A profile set to "Hidden from map"
-- was stored at 0,0 but kept location_name (e.g. "Demarest, NJ") and
-- neighborhood, so anyone querying the API could still see roughly where
-- hidden users live.
--
-- Fix: a trigger blanks every location field whenever a row is hidden, for
-- every writer (app, admin endpoint, direct API calls), then backfills
-- existing hidden rows. Safe to run more than once.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.strip_hidden_location()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.location_precision = 'hidden' THEN
    NEW.location_name := '';
    NEW.neighborhood := NULL;
    NEW.lat := 0;
    NEW.lng := 0;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS profiles_strip_hidden_location ON public.profiles;
CREATE TRIGGER profiles_strip_hidden_location
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.strip_hidden_location();

-- Backfill rows that were hidden before the trigger existed
UPDATE public.profiles
SET location_name = '', neighborhood = NULL, lat = 0, lng = 0
WHERE location_precision = 'hidden'
  AND (location_name <> '' OR neighborhood IS NOT NULL OR lat <> 0 OR lng <> 0);
