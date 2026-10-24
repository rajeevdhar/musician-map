-- Musician profiles table
-- Run this in the Supabase SQL editor (supabase.com → your project → SQL Editor)

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT NOT NULL,
  bio TEXT DEFAULT '',
  instruments TEXT[] DEFAULT '{}',
  genres TEXT[] DEFAULT '{}',
  contact_email TEXT DEFAULT '',
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  location_name TEXT DEFAULT '',
  looking_for TEXT DEFAULT '',
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Presence: updated every 60s by the client heartbeat; "online" = within 5 minutes
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ DEFAULT NOW();

-- Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Anyone can read profiles (public musician map)
CREATE POLICY "profiles_select_public"
  ON public.profiles FOR SELECT
  USING (true);

-- Only the authenticated owner can insert their own profile
CREATE POLICY "profiles_insert_own"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Only the authenticated owner can update their own profile
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Only the authenticated owner can delete their own profile
-- (Admin deletes go through the server.js service-role client, bypassing RLS)
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
CREATE POLICY IF NOT EXISTS "saved_own" ON public.saved_musicians
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
CREATE POLICY IF NOT EXISTS "messages_select" ON public.messages
  FOR SELECT USING (auth.uid() = from_id OR auth.uid() = to_id);
CREATE POLICY IF NOT EXISTS "messages_insert" ON public.messages
  FOR INSERT WITH CHECK (auth.uid() = from_id);
CREATE POLICY IF NOT EXISTS "messages_update" ON public.messages
  FOR UPDATE USING (auth.uid() = to_id);

CREATE TABLE IF NOT EXISTS public.contact_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  from_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  to_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(from_id, to_id)
);
ALTER TABLE public.contact_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "requests_select" ON public.contact_requests
  FOR SELECT USING (auth.uid() = from_id OR auth.uid() = to_id);
CREATE POLICY IF NOT EXISTS "requests_insert" ON public.contact_requests
  FOR INSERT WITH CHECK (auth.uid() = from_id);
CREATE POLICY IF NOT EXISTS "requests_update" ON public.contact_requests
  FOR UPDATE USING (auth.uid() = to_id);

-- Section 6: Profile enhancements (gear, availability, phone, primary instrument)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS primary_instrument TEXT,
  ADD COLUMN IF NOT EXISTS gear TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS availability JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS phone TEXT,
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
