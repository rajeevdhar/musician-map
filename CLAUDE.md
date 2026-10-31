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
- `VITE_GOOGLE_CLIENT_ID` — Google OAuth client ID for the "Continue with Google" button (public; unset hides the button)
- `SUPABASE_SERVICE_ROLE_KEY` — service role key used by Express server for admin operations
- `ADMIN_EMAIL` — same admin email, read server-side
- `OPENAI_API_KEY` — used only for the free Moderation API (text screening of bio/name on profile save). Leave unset to skip text moderation. Get a key at https://platform.openai.com/api-keys
- `FRONTEND_URL` — optional extra CORS origin in production (the app itself is same-origin, so normally unset)
- `RESEND_API_KEY`, `NOTIFY_FROM_EMAIL`, `NOTIFY_SECRET` — email notifications (all three needed, otherwise `/api/notify` returns 503 and nothing is sent). `NOTIFY_FROM_EMAIL` must be on a domain verified in Resend. Optional: `APP_URL` (email links, default https://musicianmapper.com), `NOTIFY_DELAY_MS` (default 120000)

**Important**: VITE_* vars are baked in at build time. Changing them in Railway requires a fresh redeploy (not just a restart).

## Architecture
```
src/
  App.tsx              — root: layout, mobile bottom tabs, modal routing via local `modal` state + store `needsPasswordReset`
  store.ts             — Zustand store: auth, musicians, filters/search, saved, messages, contact requests, toast
  types.ts             — shared types (Musician, Message) and option lists (instruments, genres, distances)
  lib/
    supabase.ts        — Supabase client (uses VITE_ env vars)
    profileColumns.ts  — PUBLIC_PROFILE_COLUMNS (use instead of select('*'))
    musicianUtils.ts   — initials, instrument codes, distance, NO_PROFILE placeholder
    presence.ts        — isOnline() from last_seen_at
    storageCleanup.ts  — removeOwnFiles(): deletes the user's unreferenced avatar/audio uploads
    moderateImage.ts   — client-side NSFW image check (nsfwjs)
    tour.ts            — first-run guided tour (driver.js)
  components/
    Header.tsx         — top bar: search, desktop tabs, Sign In / profile / admin
    MusicianMap.tsx    — Leaflet map with clustered musician pins
    MusicianList.tsx   — list panel with distance select and sorting
    FilterPanel.tsx / ActiveFilters.tsx — filter controls and active filter chips
    MusicianDetail.tsx — profile view for a selected musician (shows online status)
    ProfileModal.tsx   — edit own profile; admin mode via `adminTarget` prop
    SignupScreen.tsx / OnboardingFlow.tsx — signed-out landing and first profile setup
    LocationPinMap.tsx — Leaflet map with a draggable location pin (onboarding + ProfileModal) and Nominatim helpers
    SavedTab.tsx       — saved musicians with notes
    InboxTab.tsx / ThreadView.tsx — message threads and contact requests
    ReportModal.tsx    — report a profile
    BlockConfirm.tsx / BlockedList.tsx — block confirmation (detail + thread) and the unblock list in ProfileModal
    EmailNotifications.tsx — email notification on/off checkbox in ProfileModal
    AuthModal.tsx      — sign in / register / forgot password tabs
    ResetPasswordModal.tsx — shown after clicking a password reset email link
    AdminPanel.tsx     — admin-only panel: all profiles, online status, reports, edit/delete

server.js              — Express API server (served at /api/*) + built frontend in production
public/privacy.html    — static privacy policy, served at /privacy (linked from Google's OAuth consent screen)
supabase/schema.sql    — full DB schema + RLS policies (fresh installs)
supabase/migrations/   — one-off SQL for the live DB; run each in the Supabase SQL editor
scripts/               — seed-test-profiles.js, update-avatars.js (read .env.local, use service role key)
```

## Key design decisions
- **Private contact details** (`contact_email`, `phone`) live in `profile_contacts`, NOT in the public `profiles` table (which anyone can read). RLS: owner only, or the other party of an *accepted* `contact_requests` row. `contact_requests` can only be inserted as `pending`, and recipients may only update `status` (migration `2026-10-30_lock_requests_and_messages.sql`) — otherwise anyone could self-accept and read contacts. The account email lives only in Supabase Auth. **Never `select('*')` on `profiles`; use `PUBLIC_PROFILE_COLUMNS` from `src/lib/profileColumns.ts`, and never add private fields to `profiles`.**
- **Test profiles** are seeded into the DB by `scripts/seed-test-profiles.js` (flagged `is_test`).
- **Admin access** is checked client-side (`currentUser.email === VITE_ADMIN_EMAIL`) and server-side (`requireAdmin` middleware verifies JWT + ADMIN_EMAIL env var).
- **Online status**: a heartbeat in `store.ts` updates `profiles.last_seen_at` every 240s while a user is logged in. "Online" = active within last 5 minutes. Shown in both AdminPanel and MusicianDetail.
- **Password recovery**: Supabase fires `PASSWORD_RECOVERY` auth event (not `SIGNED_IN`) when a user clicks a reset link. The store handles this by setting `needsPasswordReset: true` and showing `ResetPasswordModal`, which calls `supabase.auth.updateUser({ password })`.
- **Google sign-in** uses Google Identity Services (`src/lib/googleIdentity.ts`), not Supabase's redirect flow: Google's own button and popup return an ID token, and `loginWithGoogle(idToken, nonce)` in `store.ts` exchanges it with `signInWithIdToken`. This is so Google's consent screen names musicianmapper.com instead of the Supabase project URL (the alternative is Supabase's paid custom domain). The button only appears when `VITE_GOOGLE_CLIENT_ID` is set, and only works on origins listed under the client's Authorized JavaScript origins (production domains + `http://localhost:5173`). GIS has one global callback, so each rendered button claims it on click. The Google button never needs the 16+ box, since an existing user can't be told apart before sign-in. Instead `AppUser.ageConfirmed` (`user_metadata.ageConfirmed`, set by email `register()`) is missing for new Google accounts, so `OnboardingFlow` asks on step 1 and saves it via `confirmAge()`; backing out of onboarding unconfirmed signs the account out, and `App.tsx` reopens onboarding on load for an unconfirmed account with no profile. `loginWithGoogle` sets `mm-onboard-pending`, and `App.tsx` opens `OnboardingFlow` on sign-in if the user has no `profiles` row. Google puts the name in `user_metadata.full_name`/`name` (email sign-up uses `displayName`); `toAppUser()` falls back through these and finally to the email's local part, never the full email. Supabase links a Google login to an existing email account with the same address. Supabase Auth → Providers → Google holds the same client ID + secret; keep "Skip nonce checks" off.
- **Email confirmation** is on in Supabase (Auth → Providers → Email → Confirm email). `register()` then gets no session back and returns `needsConfirmation`, so `SignupScreen`/`AuthModal` show "Check your email" instead of onboarding. It also sets `mm-onboard-pending` and passes `emailRedirectTo: window.location.origin`, so clicking the link signs the user in back on the site and onboarding opens (same path as Google). The link often opens in another browser (mail app, phone) where that flag doesn't exist, so `lib/supabase.ts` also reads `type=signup` from the URL hash before `createClient` clears it (`landedFromSignupLink`), and `consumeOnboardPending()` counts either. Supabase's built-in mailer only delivers to the project's team members, so production needs custom SMTP (Auth → Emails → SMTP Settings) for real users to receive confirmation and password-reset emails.
- **Admin profile editing**: `ProfileModal` accepts an `adminTarget?: Musician` prop. In admin mode it saves via `PATCH /api/admin/profile/:id` with the admin's JWT, bypassing RLS via the service role key.
- **Hidden profiles** (`location_precision = 'hidden'`) store no location: a DB trigger (`profiles_strip_hidden_location`, migration `2026-10-30_hidden_profiles_no_location.sql`) blanks `location_name`/`neighborhood` and sets lat/lng to 0, and the client maps them to NaN so they never get a pin.

- **Blocking** (`blocks` table, migration `2026-10-30_user_blocks.sql`): enforced by RLS, since the browser talks to Supabase directly. A blocked pair can't insert `messages` or `contact_requests` in either direction, accepted requests stop revealing `profile_contacts`, and a blocker's profile is hidden from people they blocked. The helpers `private.block_set()` / `private.blocked_by_set()` live in the `private` schema (not exposed over the API, so no one can RPC who blocked them) and are wrapped in `(SELECT …)` in policies so they run once per query. The blocker hides the blocked person **client-side** (`store.ts` filters `musicians`, inbox threads/requests), so their name stays available for the Blocked musicians list. Old messages are kept as evidence. The admin panel reads profiles through `GET /api/admin/profiles` (service role) so blocking the admin can't hide anyone from it. Each admin profile row shows a "Blocked by N people" badge (`GET /api/admin/block-counts`); the admin never sees who blocked whom. Blocking stops contact, not viewing: profiles stay public to signed-out visitors.

- **Privacy policy** (`public/privacy.html`) lists what the app stores and every third-party service (Supabase, Railway, Resend, Google sign-in + Fonts, OpenAI moderation, OpenStreetMap tiles/Nominatim). Update it whenever you add a new kind of user data or an outside service.

- **Email notifications** (migration `2026-10-31_email_notifications.sql`): the browser inserts messages and contact requests directly into Supabase, so the server learns about them from **Supabase Database Webhooks** (Database → Webhooks), which POST to `/api/notify` with an `x-webhook-secret: <NOTIFY_SECRET>` header. Two webhooks: `messages` on INSERT, and `contact_requests` on INSERT + UPDATE (the update emails the requester when a request is accepted). The server waits `NOTIFY_DELAY_MS`, then skips the email if the message was already read or the request answered in the app, if the recipient turned emails off (`notification_settings`, owner-only, no row = on, toggle in `EmailNotifications.tsx`), if either one blocked the other, or if the recipient is an `is_test` profile. `notification_log` (server-only) limits it to one email per recipient per person per kind every 30 min. Emails go to the Auth account email via Resend's HTTP API (no SDK). Unsubscribe links are an HMAC of the user id (`/api/unsubscribe`, GET for the footer link, POST for one-click `List-Unsubscribe`). Queued emails live in a `setTimeout`, so a redeploy drops any still waiting. No text/SMS notifications: US carriers require A2P 10DLC registration, and phone numbers were collected for sharing, not texting.

- **No Craigslist data** (removed Oct 2026): the app previously pulled posts from Craigslist's musicians RSS feed. Removed because Craigslist's terms prohibit scraping and it has sued apps for republishing listings (Craigslist v. 3Taps/PadMapper). Don't reintroduce scraping; listings should come from users of this app.

## Server API endpoints
All admin endpoints require `Authorization: Bearer <jwt>` where the JWT belongs to the admin email.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/user-stats` | List all auth users with `last_sign_in_at` |
| GET | `/api/admin/profiles` | All profiles via service role (unaffected by blocks) |
| GET | `/api/admin/block-counts` | How many people have blocked each user (counts only, never who blocked whom) |
| GET | `/api/admin/contacts` | Account emails (Auth) + private contact details, for the admin panel |
| PATCH | `/api/admin/profile/:id` | Update any profile (admin only) |
| DELETE | `/api/admin/profile/:id` | Delete a profile row (admin only) |
| DELETE | `/api/admin/user/:id` | Delete an auth user + their profile and uploaded files (admin only) |
| GET | `/api/admin/reports` | List profile reports (admin only) |
| PATCH | `/api/admin/reports/:id` | Set a report's status (admin only) |
| DELETE | `/api/self-delete` | User deletes their own account and uploaded files |
| POST | `/api/report/:profileId` | Signed-in user reports a profile |
| POST | `/api/moderate` | Screen text for hate/sexual/violence via OpenAI Moderation API (signed-in users) |
| POST | `/api/notify` | Supabase Database Webhook target; queues notification emails (`x-webhook-secret` header) |
| GET/POST | `/api/unsubscribe` | Turns off a user's notification emails (signed `u` + `t` query params) |
| GET | `/api/health` | Railway healthcheck (`railway.json`) |

Unknown `/api/*` paths return a JSON 404.

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
