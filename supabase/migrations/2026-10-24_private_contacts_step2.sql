-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 2 of 2 — remove the exposed columns (run AFTER the new code is deployed
-- and you have confirmed the app works: sign in, edit profile, request/accept
-- a contact request, open the admin panel).
--
-- This is what actually closes the leak. Until it runs, the old values are
-- still sitting in public.profiles and readable through the API.
--
-- Side effect: browser tabs still running the OLD bundle will fail to save a
-- profile until they reload. Reading the map keeps working.
-- ═══════════════════════════════════════════════════════════════════════════

-- Safety check: every profile should have a contacts row. Expect 0.
-- SELECT count(*) FROM public.profiles p
-- LEFT JOIN public.profile_contacts c ON c.id = p.id
-- WHERE c.id IS NULL;

ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS email,
  DROP COLUMN IF EXISTS contact_email,
  DROP COLUMN IF EXISTS phone;
