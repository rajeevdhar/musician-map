-- ═══════════════════════════════════════════════════════════════════════════
-- User blocking (run in the Supabase SQL editor). Safe to run more than once.
--
-- A block is one row (blocker_id, blocked_id). Enforced here, not just in the
-- UI, because the browser talks to Supabase directly with the anon key:
--   • messages / contact_requests: no new rows between a blocked pair (either direction)
--   • profile_contacts: an accepted request no longer reveals contact details
--   • profiles: you disappear from the map of anyone you've blocked
--     (the blocker hides the blocked person client-side, so their name can
--     still be shown in the blocker's "Blocked musicians" list)
--
-- The helper functions live in a `private` schema, which the Supabase API does
-- not expose, so nobody can call them over RPC to learn who blocked them.
-- Each returns a small array and is wrapped in (SELECT …)::uuid[] in policies
-- so Postgres evaluates it once per query, not once per row. (The cast matters:
-- without it, ANY ((SELECT …)) is read as a row-by-row subquery → uuid = uuid[].)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.blocks (
  blocker_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);
CREATE INDEX IF NOT EXISTS blocks_blocked_id_idx ON public.blocks (blocked_id);

ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;
-- Users see, add and remove only their own blocks; nobody can see who blocked them
DROP POLICY IF EXISTS "blocks_select_own" ON public.blocks;
CREATE POLICY "blocks_select_own" ON public.blocks
  FOR SELECT USING (auth.uid() = blocker_id);
DROP POLICY IF EXISTS "blocks_insert_own" ON public.blocks;
CREATE POLICY "blocks_insert_own" ON public.blocks
  FOR INSERT WITH CHECK (auth.uid() = blocker_id);
DROP POLICY IF EXISTS "blocks_delete_own" ON public.blocks;
CREATE POLICY "blocks_delete_own" ON public.blocks
  FOR DELETE USING (auth.uid() = blocker_id);
REVOKE UPDATE ON public.blocks FROM anon, authenticated;

CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO anon, authenticated;

-- Everyone the current user has blocked or been blocked by
CREATE OR REPLACE FUNCTION private.block_set()
RETURNS UUID[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(array_agg(other), '{}') FROM (
    SELECT blocked_id AS other FROM public.blocks WHERE blocker_id = auth.uid()
    UNION
    SELECT blocker_id FROM public.blocks WHERE blocked_id = auth.uid()
  ) s
$$;

-- Only the users who have blocked the current user
CREATE OR REPLACE FUNCTION private.blocked_by_set()
RETURNS UUID[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(array_agg(blocker_id), '{}') FROM public.blocks WHERE blocked_id = auth.uid()
$$;

REVOKE EXECUTE ON FUNCTION private.block_set() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION private.blocked_by_set() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.block_set() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION private.blocked_by_set() TO anon, authenticated;

-- Profiles: hidden from anyone the owner has blocked (signed-out visitors get an empty set)
DROP POLICY IF EXISTS "profiles_select_public" ON public.profiles;
CREATE POLICY "profiles_select_public"
  ON public.profiles FOR SELECT
  USING (NOT (id = ANY ((SELECT private.blocked_by_set())::uuid[])));

-- Messages: can't message someone in a blocked pair
DROP POLICY IF EXISTS "messages_insert" ON public.messages;
CREATE POLICY "messages_insert" ON public.messages
  FOR INSERT WITH CHECK (
    auth.uid() = from_id AND NOT (to_id = ANY ((SELECT private.block_set())::uuid[]))
  );

-- Contact requests: same rule, on top of the 'pending'-only lock
DROP POLICY IF EXISTS "requests_insert" ON public.contact_requests;
CREATE POLICY "requests_insert" ON public.contact_requests
  FOR INSERT WITH CHECK (
    auth.uid() = from_id AND status = 'pending' AND from_id <> to_id
    AND NOT (to_id = ANY ((SELECT private.block_set())::uuid[]))
  );

-- Private contacts: blocking revokes access that an accepted request granted
DROP POLICY IF EXISTS "contacts_accepted_read" ON public.profile_contacts;
CREATE POLICY "contacts_accepted_read" ON public.profile_contacts
  FOR SELECT USING (
    NOT (profile_contacts.id = ANY ((SELECT private.block_set())::uuid[]))
    AND EXISTS (
      SELECT 1 FROM public.contact_requests r
      WHERE r.status = 'accepted'
        AND ((r.from_id = auth.uid() AND r.to_id = profile_contacts.id)
          OR (r.to_id   = auth.uid() AND r.from_id = profile_contacts.id))
    )
  );
