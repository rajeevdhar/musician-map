# MusicianMap — Claude Context

## What this is
A full-stack web app where musicians can add themselves to a map, browse other musicians nearby, and connect. Built with React + Vite (frontend), Express (backend API), and Supabase (auth + database).

## Live deployment
- **Production URL**: https://musician-map-production.up.railway.app
- **Hosting**: Railway (auto-deploys from `main` branch on GitHub)
- **Build command**: `npm run build` (tsc + vite build)
- **Start command**: `node server.js`
- **Node requirement**: >=22 (set in `package.json` engines — required by @supabase/supabase-js 2.118+)

## Supabase project
- **Project URL**: https://rtjisjrqjtkrmadfwwwk.supabase.co
- **Schema**: `supabase/schema.sql`
- **Key table**: `profiles` — one row per registered user who has saved their profile
- **Extra column added post-init**: `last_seen_at TIMESTAMPTZ` (added via SQL editor: `ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ DEFAULT NOW()`)
- **Auth URL config**: Site URL and redirect URL both set to the Railway production URL

## Environment variables
Set in Railway dashboard and locally in `.env.local` (gitignored):
- `VITE_SUPABASE_URL` / `SUPABASE_URL` — Supabase project URL (VITE_ prefix = baked into frontend bundle at build time)
- `VITE_SUPABASE_ANON_KEY` / `SUPABASE_ANON_KEY` — public anon key
- `VITE_ADMIN_EMAIL` — email address that gets admin access (rajeev.dhar@gmail.com)
- `SUPABASE_SERVICE_ROLE_KEY` — service role key used by Express server for admin operations
- `ADMIN_EMAIL` — same admin email, read server-side

**Important**: VITE_* vars are baked in at build time. Changing them in Railway requires a fresh redeploy (not just a restart).

## Architecture
```
src/
  App.tsx              — root, modal routing via local `modal` state + store `needsPasswordReset`
  store.ts             — Zustand store: auth, musicians, UI state
  types.ts             — shared TypeScript types (Musician, ActiveModal, etc.)
  lib/supabase.ts      — Supabase client (uses VITE_ env vars)
  components/
    Header.tsx         — top bar with Sign In / profile / admin buttons
    MusicianMap.tsx    — Leaflet map with musician pins
    MusicianDetail.tsx — profile popup when clicking a pin (shows online status)
    ProfileModal.tsx   — edit own profile; admin mode via `adminTarget` prop
    AuthModal.tsx      — sign in / register / forgot password tabs
    ResetPasswordModal.tsx — shown after clicking a password reset email link
    AdminPanel.tsx     — admin-only panel: all profiles, online status, edit/delete
    MapLegend.tsx      — map legend overlay

server.js              — Express API server (served at /api/*)
supabase/schema.sql    — full DB schema + RLS policies
```

## Key design decisions
- **Seed musicians** (Maya Chen, Darius Knight, etc.) are hard-coded in `store.ts` — not in the DB. They fill the map on first load.
- **Admin access** is checked client-side (`currentUser.email === VITE_ADMIN_EMAIL`) and server-side (`requireAdmin` middleware verifies JWT + ADMIN_EMAIL env var).
- **Online status**: a heartbeat in `store.ts` updates `profiles.last_seen_at` every 60s while a user is logged in. "Online" = active within last 5 minutes. Shown in both AdminPanel and MusicianDetail.
- **Password recovery**: Supabase fires `PASSWORD_RECOVERY` auth event (not `SIGNED_IN`) when a user clicks a reset link. The store handles this by setting `needsPasswordReset: true` and showing `ResetPasswordModal`, which calls `supabase.auth.updateUser({ password })`.
- **Admin profile editing**: `ProfileModal` accepts an `adminTarget?: Musician` prop. In admin mode it saves via `PATCH /api/admin/profile/:id` with the admin's JWT, bypassing RLS via the service role key.

- **No Craigslist data** (removed Oct 2026): the app previously pulled posts from Craigslist's musicians RSS feed. Removed because Craigslist's terms prohibit scraping and it has sued apps for republishing listings (Craigslist v. 3Taps/PadMapper). Don't reintroduce scraping; listings should come from users of this app.

## Server API endpoints
All admin endpoints require `Authorization: Bearer <jwt>` where the JWT belongs to the admin email.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/user-stats` | List all auth users with `last_sign_in_at` |
| PATCH | `/api/admin/profile/:id` | Update any profile (admin only) |
| DELETE | `/api/admin/profile/:id` | Delete a profile row (admin only) |
| DELETE | `/api/admin/user/:id` | Delete an auth user + their profile (admin only) |
| DELETE | `/api/self-delete` | User deletes their own account |

## Running locally
```bash
cp .env.local.example .env.local   # fill in Supabase keys
npm install
npm run dev                         # starts Vite (port 5173) + Express (port 3001) concurrently
```

## Deploying
Push to `main` — Railway auto-deploys. Watch the build log; common issues:
- Node version: must be 22+ (engines field in package.json handles this)
- VITE_* vars must exist before `npm run build` runs
