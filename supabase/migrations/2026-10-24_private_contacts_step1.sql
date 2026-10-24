-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 1 of 2 — private contact details (ADDITIVE, safe to run BEFORE deploy)
-- Run in the Supabase SQL editor.
--
-- Problem: profiles has a public SELECT policy (USING (true)), and the app read
-- every column, so profiles.email (the account email), contact_email and phone
-- were downloadable by anyone with the public anon key. The "request contact,
-- then reveal" flow only hid them in the UI.
--
-- Fix: contact_email and phone move to profile_contacts, readable only by the
-- owner, or by the other person in an ACCEPTED contact request. The account
-- email is not copied anywhere; it stays in Supabase Auth (auth.users).
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.profile_contacts (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_email TEXT DEFAULT '',
  phone TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profile_contacts ENABLE ROW LEVEL SECURITY;

-- Owner: full access to their own row
DROP POLICY IF EXISTS "contacts_owner_all" ON public.profile_contacts;
CREATE POLICY "contacts_owner_all" ON public.profile_contacts
  FOR ALL
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Other users: read-only, and only after a contact request between the two
-- of you has been accepted (in either direction).
DROP POLICY IF EXISTS "contacts_accepted_read" ON public.profile_contacts;
CREATE POLICY "contacts_accepted_read" ON public.profile_contacts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.contact_requests r
      WHERE r.status = 'accepted'
        AND (
          (r.from_id = auth.uid() AND r.to_id = profile_contacts.id) OR
          (r.to_id   = auth.uid() AND r.from_id = profile_contacts.id)
        )
    )
  );

-- Backfill existing data (idempotent)
INSERT INTO public.profile_contacts (id, contact_email, phone)
SELECT id, COALESCE(contact_email, ''), phone
FROM public.profiles
ON CONFLICT (id) DO NOTHING;

-- New code no longer writes the account email to profiles; let the column go empty.
ALTER TABLE public.profiles ALTER COLUMN email DROP NOT NULL;
