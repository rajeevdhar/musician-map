-- ═══════════════════════════════════════════════════════════════════════════
-- Lock down contact_requests and messages (run in the Supabase SQL editor)
--
-- Problem: the INSERT policy on contact_requests only checked from_id, so a
-- signed-in user could insert {from_id: me, to_id: victim, status: 'accepted'}
-- and then read the victim's profile_contacts row via "contacts_accepted_read".
-- The UPDATE policy also let the recipient rewrite from_id to anyone.
-- The messages UPDATE policy let a recipient rewrite body/from_id.
--
-- Fix: new requests must be 'pending'; recipients may only change status
-- (requests) or read_at (messages). Safe to run more than once.
-- ═══════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "requests_insert" ON public.contact_requests;
CREATE POLICY "requests_insert" ON public.contact_requests
  FOR INSERT WITH CHECK (auth.uid() = from_id AND status = 'pending' AND from_id <> to_id);

DROP POLICY IF EXISTS "requests_update" ON public.contact_requests;
CREATE POLICY "requests_update" ON public.contact_requests
  FOR UPDATE USING (auth.uid() = to_id) WITH CHECK (auth.uid() = to_id);

REVOKE UPDATE ON public.contact_requests FROM anon, authenticated;
GRANT UPDATE (status) ON public.contact_requests TO authenticated;

DROP POLICY IF EXISTS "messages_update" ON public.messages;
CREATE POLICY "messages_update" ON public.messages
  FOR UPDATE USING (auth.uid() = to_id) WITH CHECK (auth.uid() = to_id);

REVOKE UPDATE ON public.messages FROM anon, authenticated;
GRANT UPDATE (read_at) ON public.messages TO authenticated;

-- Audit: accepted requests that were never pending can't be told apart after
-- the fact, but this lists every accepted pair so you can eyeball anything odd
-- (e.g. a request "from" someone who has never messaged or saved the other).
-- SELECT r.created_at, r.from_id, r.to_id FROM public.contact_requests r
-- WHERE r.status = 'accepted' ORDER BY r.created_at DESC;
