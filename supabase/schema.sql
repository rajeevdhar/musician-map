-- Musician profiles table
-- Run this in the Supabase SQL editor (supabase.com → your project → SQL Editor)

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  bio TEXT DEFAULT '',
  instruments TEXT[] DEFAULT '{}',
  genres TEXT[] DEFAULT '{}',
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  location_name TEXT DEFAULT '',
  looking_for TEXT DEFAULT '',
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Presence: updated every 240s by the client heartbeat; "online" = within 5 minutes
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ DEFAULT NOW();

-- Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Anyone can read profiles (public musician map)
-- (Section 10 replaces this to hide a profile from users its owner has blocked)
DROP POLICY IF EXISTS "profiles_select_public" ON public.profiles;
CREATE POLICY "profiles_select_public"
  ON public.profiles FOR SELECT
  USING (true);

-- Only the authenticated owner can insert their own profile
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Only the authenticated owner can update their own profile
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Only the authenticated owner can delete their own profile
-- (Admin deletes go through the server.js service-role client, bypassing RLS)
DROP POLICY IF EXISTS "profiles_delete_own" ON public.profiles;
CREATE POLICY "profiles_delete_own"
  ON public.profiles FOR DELETE
  USING (auth.uid() = id);

-- Auto-update updated_at on every row change
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Section 4 additions (run in Supabase SQL editor if upgrading an existing project)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS location_precision TEXT DEFAULT 'exact',
  ADD COLUMN IF NOT EXISTS neighborhood TEXT,
  ADD COLUMN IF NOT EXISTS level TEXT;

-- Section 5 additions: saved musicians, messages, contact requests
CREATE TABLE IF NOT EXISTS public.saved_musicians (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  musician_id TEXT NOT NULL,
  note TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, musician_id)
);
ALTER TABLE public.saved_musicians ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "saved_own" ON public.saved_musicians;
CREATE POLICY "saved_own" ON public.saved_musicians
  FOR ALL USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  from_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  to_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  read_at TIMESTAMPTZ
);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "messages_select" ON public.messages;
CREATE POLICY "messages_select" ON public.messages
  FOR SELECT USING (auth.uid() = from_id OR auth.uid() = to_id);
-- (Section 10 replaces messages_insert, requests_insert and contacts_accepted_read with block-aware versions)
DROP POLICY IF EXISTS "messages_insert" ON public.messages;
CREATE POLICY "messages_insert" ON public.messages
  FOR INSERT WITH CHECK (auth.uid() = from_id);
DROP POLICY IF EXISTS "messages_update" ON public.messages;
CREATE POLICY "messages_update" ON public.messages
  FOR UPDATE USING (auth.uid() = to_id) WITH CHECK (auth.uid() = to_id);
-- Recipients may only mark messages read
REVOKE UPDATE ON public.messages FROM anon, authenticated;
GRANT UPDATE (read_at) ON public.messages TO authenticated;

CREATE TABLE IF NOT EXISTS public.contact_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  from_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  to_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(from_id, to_id)
);
ALTER TABLE public.contact_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "requests_select" ON public.contact_requests;
CREATE POLICY "requests_select" ON public.contact_requests
  FOR SELECT USING (auth.uid() = from_id OR auth.uid() = to_id);
-- New requests must start 'pending' (see migrations/2026-10-30_lock_requests_and_messages.sql)
DROP POLICY IF EXISTS "requests_insert" ON public.contact_requests;
CREATE POLICY "requests_insert" ON public.contact_requests
  FOR INSERT WITH CHECK (auth.uid() = from_id AND status = 'pending' AND from_id <> to_id);
DROP POLICY IF EXISTS "requests_update" ON public.contact_requests;
CREATE POLICY "requests_update" ON public.contact_requests
  FOR UPDATE USING (auth.uid() = to_id) WITH CHECK (auth.uid() = to_id);
-- Recipients may only change status
REVOKE UPDATE ON public.contact_requests FROM anon, authenticated;
GRANT UPDATE (status) ON public.contact_requests TO authenticated;

-- Section 6: Profile enhancements (gear, availability, primary instrument)
-- (phone lives in profile_contacts — never add private fields to profiles)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS primary_instrument TEXT,
  ADD COLUMN IF NOT EXISTS gear TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS availability JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS years_playing INTEGER;

-- Test profiles flag (set by seed script, shown in AdminPanel)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_test BOOLEAN DEFAULT FALSE;

-- Teacher flag: user explicitly offers music lessons; amber pin on map
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS offers_lessons BOOLEAN DEFAULT FALSE;

-- Rich profile fields: social links + audio clip
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS website_url TEXT,
  ADD COLUMN IF NOT EXISTS instagram_url TEXT,
  ADD COLUMN IF NOT EXISTS youtube_url TEXT,
  ADD COLUMN IF NOT EXISTS soundcloud_url TEXT,
  ADD COLUMN IF NOT EXISTS bandcamp_url TEXT,
  ADD COLUMN IF NOT EXISTS tiktok_url TEXT,
  ADD COLUMN IF NOT EXISTS audio_url TEXT,
  ADD COLUMN IF NOT EXISTS discord_url TEXT;

-- Audio storage bucket (public read, users write to their own folder)
-- Run once in Supabase SQL editor:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('musician-audio', 'musician-audio', true) ON CONFLICT (id) DO NOTHING;
-- DROP POLICY IF EXISTS "audio_public_read" ON storage.objects;
-- DROP POLICY IF EXISTS "audio_user_insert" ON storage.objects;
-- DROP POLICY IF EXISTS "audio_user_update" ON storage.objects;
-- DROP POLICY IF EXISTS "audio_user_delete" ON storage.objects;
-- CREATE POLICY "audio_public_read" ON storage.objects FOR SELECT USING (bucket_id = 'musician-audio');
-- CREATE POLICY "audio_user_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'musician-audio' AND split_part(name, '/', 1) = auth.uid()::text);
-- CREATE POLICY "audio_user_update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'musician-audio' AND split_part(name, '/', 1) = auth.uid()::text);
-- CREATE POLICY "audio_user_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'musician-audio' AND split_part(name, '/', 1) = auth.uid()::text);

-- Avatar storage bucket (public read, users write to their own folder)
-- Run once in Supabase SQL editor:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT (id) DO NOTHING;
-- DROP POLICY IF EXISTS "avatars_public_read" ON storage.objects;
-- DROP POLICY IF EXISTS "avatars_user_insert" ON storage.objects;
-- DROP POLICY IF EXISTS "avatars_user_update" ON storage.objects;
-- DROP POLICY IF EXISTS "avatars_user_delete" ON storage.objects;
-- CREATE POLICY "avatars_public_read" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
-- CREATE POLICY "avatars_user_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars' AND split_part(name, '/', 1) = auth.uid()::text);
-- CREATE POLICY "avatars_user_update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'avatars' AND split_part(name, '/', 1) = auth.uid()::text);
-- CREATE POLICY "avatars_user_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'avatars' AND split_part(name, '/', 1) = auth.uid()::text);

-- Section 8: User reports (run in Supabase SQL editor)
-- Stores flags submitted by signed-in users against another user's profile.
-- Admin reviews and resolves via the AdminPanel Reports tab.
CREATE TABLE IF NOT EXISTS public.reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  reported_profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (reason IN ('inappropriate_image','offensive_content','harassment','spam','fake_profile','other')),
  details TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','reviewed','actioned','dismissed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  UNIQUE(reported_profile_id, reporter_id)  -- one report per reporter per profile
);
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
-- Any signed-in user can file a report
DROP POLICY IF EXISTS "reports_insert_auth" ON public.reports;
CREATE POLICY "reports_insert_auth" ON public.reports
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = reporter_id);
-- Reporters can see their own submissions (for UI feedback)
DROP POLICY IF EXISTS "reports_select_own" ON public.reports;
CREATE POLICY "reports_select_own" ON public.reports
  FOR SELECT USING (auth.uid() = reporter_id);
-- Admin reads/updates via service role key (bypasses RLS) — no additional policy needed.

-- Section 7: Private contact details (see supabase/migrations/2026-10-24_private_contacts_step*.sql)
-- profiles.email, profiles.contact_email and profiles.phone were publicly readable and have been
-- REMOVED (step 2). contact_email + phone now live here: owner-only, or readable by the other
-- party of an ACCEPTED contact request. The account email stays in auth.users only.
CREATE TABLE IF NOT EXISTS public.profile_contacts (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_email TEXT DEFAULT '',
  phone TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.profile_contacts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "contacts_owner_all" ON public.profile_contacts;
CREATE POLICY "contacts_owner_all" ON public.profile_contacts
  FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "contacts_accepted_read" ON public.profile_contacts;
CREATE POLICY "contacts_accepted_read" ON public.profile_contacts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.contact_requests r
      WHERE r.status = 'accepted'
        AND ((r.from_id = auth.uid() AND r.to_id = profile_contacts.id)
          OR (r.to_id   = auth.uid() AND r.from_id = profile_contacts.id))
    )
  );

-- Section 9: Hidden profiles publish no location (see migrations/2026-10-30_hidden_profiles_no_location.sql)
-- profiles is publicly readable, so a hidden row must not keep its town name or coordinates.
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

-- Section 10: User blocking (see migrations/2026-10-30_user_blocks.sql)
-- One row per (blocker, blocked). Blocked pairs can't message or send contact requests,
-- accepted requests stop revealing contacts, and a blocker's profile is hidden from the
-- people they blocked. Helpers live in the non-API `private` schema so nobody can RPC
-- them to learn who blocked them.

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

-- Section 11: Email notifications (see migrations/2026-10-31_email_notifications.sql)
-- notification_settings: owner-only on/off switch (no row = on).
-- notification_log: server-only throttle, one email per person per 30 min.
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
