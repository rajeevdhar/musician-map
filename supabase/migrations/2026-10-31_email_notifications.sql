-- ═══════════════════════════════════════════════════════════════════════════
-- Email notifications (run in the Supabase SQL editor). Safe to run more than once.
--
-- The browser writes messages / contact_requests straight to Supabase, so the
-- server learns about them from Database Webhooks (Database → Webhooks) that
-- POST to /api/notify. This migration only adds two new tables:
--   • notification_settings: the user's on/off switch. No row = emails on.
--     Owner-only, and kept out of the public profiles table.
--   • notification_log: when we last emailed someone about a given person, so
--     a burst of messages sends one email. Server-only (RLS on, no policies).
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.notification_settings (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notification_settings_own" ON public.notification_settings;
CREATE POLICY "notification_settings_own" ON public.notification_settings
  FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE TABLE IF NOT EXISTS public.notification_log (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  other_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('message', 'request', 'accepted')),
  last_emailed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, other_id, kind)
);
ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.notification_log FROM anon, authenticated;
