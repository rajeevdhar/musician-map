import { config } from 'dotenv'
config({ path: '.env.local' })

import express from 'express'
import cors from 'cors'
import { createClient } from '@supabase/supabase-js'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { createHmac, timingSafeEqual } from 'crypto'

const __dirname = dirname(fileURLToPath(import.meta.url))
const isProd = process.env.NODE_ENV === 'production'

const supabaseAdmin = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null

const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY

// Separate client with anon key for JWT verification (works with both legacy and new key formats)
const supabaseVerify = process.env.SUPABASE_URL && SUPABASE_ANON_KEY
  ? createClient(process.env.SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : supabaseAdmin

// Returns a Supabase client that acts as the authenticated user (respects RLS)
function supabaseAsUser(token) {
  return createClient(process.env.SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
}

// Verify the JWT belongs to a real user; also check admin email for privileged routes
async function verifyJwt(req) {
  const token = req.headers.authorization?.split(' ')[1]
  if (!token || !supabaseVerify) return null
  const { data: { user }, error } = await supabaseVerify.auth.getUser(token)
  return error ? null : user
}

const app = express()
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:4173',
  process.env.FRONTEND_URL,
].filter(Boolean)
app.use(cors({ origin: isProd ? allowedOrigins : true }))
app.use(express.json())

// ── Content moderation (text) — uses OpenAI Moderation API (free) ────────────
// Returns { flagged: boolean, categories: string[] }
async function moderateText(text) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return { flagged: false, categories: [] }
  const res = await fetch('https://api.openai.com/v1/moderations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ input: text }),
  })
  if (!res.ok) return { flagged: false, categories: [] }
  const data = await res.json()
  const result = data.results?.[0]
  if (!result?.flagged) return { flagged: false, categories: [] }
  const categories = Object.entries(result.categories ?? {})
    .filter(([, v]) => v)
    .map(([k]) => k)
  return { flagged: true, categories }
}

app.post('/api/moderate', async (req, res) => {
  // Signed-in users only, so the OpenAI key can't be used as an open proxy
  if (!(await verifyJwt(req))) return res.status(401).json({ error: 'Unauthorized' })
  const { texts } = req.body
  if (!Array.isArray(texts) || texts.length === 0) return res.json({ ok: true })
  const combined = texts.filter(Boolean).join('\n\n')
  if (!combined.trim()) return res.json({ ok: true })
  try {
    const result = await moderateText(combined)
    res.json(result)
  } catch {
    res.json({ flagged: false, categories: [] })
  }
})

// Public storage buckets keep files after the auth user is gone; remove them explicitly
const USER_BUCKETS = ['avatars', 'musician-audio']
async function removeUserFiles(userId) {
  for (const bucket of USER_BUCKETS) {
    const { data: files } = await supabaseAdmin.storage.from(bucket).list(userId)
    if (files?.length) {
      await supabaseAdmin.storage.from(bucket).remove(files.map(f => `${userId}/${f.name}`))
    }
  }
}

// ── Self-delete: user deletes their own account ───────────────────────────────
app.delete('/api/self-delete', async (req, res) => {
  const user = await verifyJwt(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })
  if (!supabaseAdmin) return res.status(503).json({ error: 'Admin client not configured' })
  await removeUserFiles(user.id)
  const { error } = await supabaseAdmin.auth.admin.deleteUser(user.id)
  if (error) return res.status(500).json({ error: error.message })
  res.json({ ok: true })
})

// ── Admin routes (require ADMIN_EMAIL) ────────────────────────────────────────
async function requireAdmin(req, res, next) {
  const user = await verifyJwt(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })
  if (user.email !== process.env.ADMIN_EMAIL) return res.status(403).json({ error: 'Forbidden' })
  req.adminUser = user
  next()
}

// Get auth user stats (last sign-in time for each user)
app.get('/api/admin/user-stats', requireAdmin, async (req, res) => {
  if (!supabaseAdmin) return res.status(503).json({ error: 'Admin client not configured' })
  const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })
  if (error) return res.status(500).json({ error: error.message })
  res.json({
    users: users.map(u => ({ id: u.id, lastSignInAt: u.last_sign_in_at })),
  })
})

// Admin: how many people have blocked each user — counts only, never who blocked whom
app.get('/api/admin/block-counts', requireAdmin, async (req, res) => {
  if (!supabaseAdmin) return res.status(503).json({ error: 'Admin client not configured' })
  const counts = {}
  // Page through: the API returns at most 1000 rows per request
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabaseAdmin
      .from('blocks')
      .select('blocked_id')
      .order('blocked_id')
      .order('blocker_id') // unique (primary key) order so pages don't overlap
      .range(from, from + 999)
    if (error) return res.status(500).json({ error: error.message })
    for (const { blocked_id } of data) counts[blocked_id] = (counts[blocked_id] ?? 0) + 1
    if (data.length < 1000) break
  }
  res.json({ counts })
})

// Admin: account emails (from Supabase Auth) + private contact details, keyed by user id
app.get('/api/admin/contacts', requireAdmin, async (req, res) => {
  if (!supabaseAdmin) return res.status(503).json({ error: 'Admin client not configured' })
  const [{ data: { users }, error: uErr }, { data: contacts, error: cErr }] = await Promise.all([
    supabaseAdmin.auth.admin.listUsers({ perPage: 1000 }),
    supabaseAdmin.from('profile_contacts').select('id, contact_email, phone'),
  ])
  if (uErr) return res.status(500).json({ error: uErr.message })
  if (cErr) return res.status(500).json({ error: cErr.message })
  const byId = new Map((contacts ?? []).map(c => [c.id, c]))
  res.json({
    contacts: users.map(u => ({
      id: u.id,
      email: u.email,
      contactEmail: byId.get(u.id)?.contact_email ?? '',
      phone: byId.get(u.id)?.phone ?? null,
    })),
  })
})

// Admin: all profiles via the service role. Reading with the admin's own JWT would let
// anyone hide from the admin panel by blocking the admin account (RLS on profiles).
const ADMIN_PROFILE_COLUMNS = 'id, display_name, bio, instruments, genres, lat, lng, location_name, looking_for, avatar_url, created_at, last_seen_at, is_test, offers_lessons'
app.get('/api/admin/profiles', requireAdmin, async (req, res) => {
  if (!supabaseAdmin) return res.status(503).json({ error: 'Admin client not configured' })
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select(ADMIN_PROFILE_COLUMNS)
    .order('created_at', { ascending: false })
  if (error) return res.status(500).json({ error: error.message })
  res.json({ profiles: data })
})

// Admin: update any profile (bypasses RLS via service role)
app.patch('/api/admin/profile/:id', requireAdmin, async (req, res) => {
  if (!supabaseAdmin) return res.status(503).json({ error: 'Admin client not configured' })
  const allowed = ['display_name','bio','instruments','genres','lat','lng','location_name','looking_for','website_url','instagram_url','youtube_url','soundcloud_url','bandcamp_url','tiktok_url']
  const update = {}
  for (const key of allowed) {
    if (req.body[key] !== undefined) update[key] = req.body[key]
  }
  const { error } = await supabaseAdmin.from('profiles').update(update).eq('id', req.params.id)
  if (error) return res.status(500).json({ error: error.message })
  // contact_email is private: it lives in profile_contacts, not in public profiles
  if (req.body.contact_email !== undefined) {
    const { error: cErr } = await supabaseAdmin
      .from('profile_contacts')
      .upsert({ id: req.params.id, contact_email: req.body.contact_email, updated_at: new Date().toISOString() })
    if (cErr) return res.status(500).json({ error: cErr.message })
  }
  res.json({ ok: true })
})

// Remove a musician profile (keeps the auth account)
app.delete('/api/admin/profile/:id', requireAdmin, async (req, res) => {
  if (!supabaseAdmin) return res.status(503).json({ error: 'Admin client not configured' })
  const { error } = await supabaseAdmin
    .from('profiles')
    .delete()
    .eq('id', req.params.id)
  if (error) return res.status(500).json({ error: error.message })
  res.json({ ok: true })
})

// Delete a user account entirely (profile row cascades via ON DELETE CASCADE)
app.delete('/api/admin/user/:id', requireAdmin, async (req, res) => {
  if (!supabaseAdmin) return res.status(503).json({ error: 'Admin client not configured' })
  await removeUserFiles(req.params.id)
  const { error } = await supabaseAdmin.auth.admin.deleteUser(req.params.id)
  if (error) return res.status(500).json({ error: error.message })
  res.json({ ok: true })
})

// ── Report a profile (any authenticated user) ─────────────────────────────────
const VALID_REASONS = ['inappropriate_image','offensive_content','harassment','spam','fake_profile','other']

app.post('/api/report/:profileId', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1]
  const user = await verifyJwt(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })
  const { reason, details } = req.body
  if (!VALID_REASONS.includes(reason)) return res.status(400).json({ error: 'Invalid reason' })
  // Use the user's own JWT so RLS enforces reporter_id = auth.uid()
  const { error } = await supabaseAsUser(token).from('reports').insert({
    reported_profile_id: req.params.profileId,
    reporter_id: user.id,
    reason,
    details: (details ?? '').slice(0, 500),
  })
  if (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'Already reported' })
    return res.status(500).json({ error: error.message })
  }
  res.json({ ok: true })
})

// ── Admin: list reports ───────────────────────────────────────────────────────
app.get('/api/admin/reports', requireAdmin, async (req, res) => {
  if (!supabaseAdmin) return res.status(503).json({ error: 'Admin client not configured' })
  const { data, error } = await supabaseAdmin
    .from('reports')
    .select('id, reason, details, status, created_at, reported_profile_id, reporter_id')
    .order('created_at', { ascending: false })
  if (error) return res.status(500).json({ error: error.message })
  res.json({ reports: data })
})

// ── Admin: update report status ───────────────────────────────────────────────
app.patch('/api/admin/reports/:id', requireAdmin, async (req, res) => {
  if (!supabaseAdmin) return res.status(503).json({ error: 'Admin client not configured' })
  const { status } = req.body
  if (!['reviewed','actioned','dismissed'].includes(status)) return res.status(400).json({ error: 'Invalid status' })
  const { error } = await supabaseAdmin
    .from('reports')
    .update({ status, reviewed_at: new Date().toISOString() })
    .eq('id', req.params.id)
  if (error) return res.status(500).json({ error: error.message })
  res.json({ ok: true })
})

// ── Email notifications ───────────────────────────────────────────────────────
// The browser writes messages and contact requests straight to Supabase, so the
// server hears about them from Supabase Database Webhooks that POST here with
// the NOTIFY_SECRET header. Emails are sent through Resend.
const APP_URL = process.env.APP_URL || 'https://musicianmapper.com'
const NOTIFY_DELAY_MS = Number(process.env.NOTIFY_DELAY_MS ?? 120_000) // time to read it in the app first
const NOTIFY_THROTTLE_MS = 30 * 60_000 // at most one email per person per kind in this window
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const notificationsConfigured = () =>
  !!(supabaseAdmin && process.env.NOTIFY_SECRET && process.env.RESEND_API_KEY && process.env.NOTIFY_FROM_EMAIL)

function secretsMatch(given, expected) {
  // Trimmed: a pasted secret easily picks up a trailing space or newline
  const a = Buffer.from(String(given ?? '').trim()), b = Buffer.from(String(expected ?? '').trim())
  return a.length === b.length && timingSafeEqual(a, b)
}

// Unsubscribe links carry an HMAC of the user id, so no token has to be stored
function unsubscribeToken(userId) {
  return createHmac('sha256', process.env.NOTIFY_SECRET).update(`unsubscribe:${userId}`).digest('base64url')
}
const unsubscribeUrl = userId => `${APP_URL}/api/unsubscribe?u=${userId}&t=${unsubscribeToken(userId)}`

const escapeHtml = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

async function sendEmail({ to, userId, subject, heading, preview, cta }) {
  const unsub = unsubscribeUrl(userId)
  const text = `${heading}\n\n${preview ? `"${preview}"\n\n` : ''}${cta}: ${APP_URL}\n\nTurn off these emails: ${unsub}`
  const html = `<div style="font-family:Arial,sans-serif;max-width:480px;color:#111">
  <p style="font-size:16px;font-weight:bold">${escapeHtml(heading)}</p>
  ${preview ? `<p style="font-size:14px;border-left:3px solid #111;padding-left:12px;white-space:pre-wrap">${escapeHtml(preview)}</p>` : ''}
  <p><a href="${APP_URL}" style="display:inline-block;background:#111;color:#fff;padding:10px 16px;text-decoration:none;font-weight:bold;font-size:14px">${escapeHtml(cta)}</a></p>
  <p style="font-size:12px;color:#666">You're getting this because you have a MusicianMap account.
  <a href="${unsub}" style="color:#666">Turn off these emails</a>.</p>
</div>`
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.NOTIFY_FROM_EMAIL,
      to,
      subject,
      text,
      html,
      headers: { 'List-Unsubscribe': `<${unsub}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
    }),
  })
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`)
}

// Claim the right to email userId about otherId; false if we already did within the
// throttle window. Each statement is atomic, so two webhooks racing can't both win.
async function claimNotification(userId, otherId, kind) {
  const key = { user_id: userId, other_id: otherId, kind }
  const { data: inserted, error } = await supabaseAdmin
    .from('notification_log')
    .upsert(key, { onConflict: 'user_id,other_id,kind', ignoreDuplicates: true })
    .select('user_id')
  if (error) throw error
  if (inserted?.length) return true
  const { data: updated, error: uErr } = await supabaseAdmin
    .from('notification_log')
    .update({ last_emailed_at: new Date().toISOString() })
    .match(key)
    .lt('last_emailed_at', new Date(Date.now() - NOTIFY_THROTTLE_MS).toISOString())
    .select('user_id')
  if (uErr) throw uErr
  return !!updated?.length
}

// Emails recipientId about something otherId did, unless it was already seen in the
// app, the recipient opted out, either one blocked the other, or it's a test profile
async function deliverNotification({ kind, recipientId, otherId, stillRelevant, compose }) {
  if (!(await stillRelevant())) return 'already handled in app'
  const [settings, blocks, profiles, auth] = await Promise.all([
    supabaseAdmin.from('notification_settings').select('email_enabled').eq('id', recipientId).maybeSingle(),
    supabaseAdmin.from('blocks').select('blocker_id')
      .or(`and(blocker_id.eq.${recipientId},blocked_id.eq.${otherId}),and(blocker_id.eq.${otherId},blocked_id.eq.${recipientId})`),
    supabaseAdmin.from('profiles').select('id, display_name, is_test').in('id', [recipientId, otherId]),
    supabaseAdmin.auth.admin.getUserById(recipientId),
  ])
  for (const r of [settings, blocks, profiles, auth]) if (r.error) throw r.error
  if (settings.data?.email_enabled === false) return 'opted out'
  if (blocks.data.length) return 'blocked'
  const recipient = profiles.data.find(p => p.id === recipientId)
  const email = auth.data.user?.email
  if (!email || recipient?.is_test) return 'no email'
  if (!(await claimNotification(recipientId, otherId, kind))) return 'throttled'
  const name = profiles.data.find(p => p.id === otherId)?.display_name || 'A musician'
  await sendEmail({ to: email, userId: recipientId, ...compose(name) })
  return 'sent'
}

app.post('/api/notify', (req, res) => {
  // Checked first so a 401 always means a wrong secret, never a missing variable
  if (!notificationsConfigured()) return res.status(503).json({ error: 'Email notifications not configured' })
  if (!secretsMatch(req.headers['x-webhook-secret'], process.env.NOTIFY_SECRET)) {
    console.warn(`Notify rejected: ${req.headers['x-webhook-secret'] ? 'wrong' : 'missing'} x-webhook-secret header`)
    return res.status(401).json({ error: 'Unauthorized' })
  }
  const { type, table, record, old_record } = req.body ?? {}
  if (!record || !UUID_RE.test(record.id) || !UUID_RE.test(record.from_id) || !UUID_RE.test(record.to_id)) {
    return res.json({ ok: true, queued: false })
  }

  let job = null
  if (table === 'messages' && type === 'INSERT') {
    job = {
      kind: 'message', recipientId: record.to_id, otherId: record.from_id,
      stillRelevant: async () => {
        const { data } = await supabaseAdmin.from('messages').select('read_at').eq('id', record.id).maybeSingle()
        return !!data && !data.read_at
      },
      compose: name => ({
        subject: `${name} sent you a message on MusicianMap`,
        heading: `${name} sent you a message`,
        preview: String(record.body ?? '').slice(0, 300),
        cta: 'Reply on MusicianMap',
      }),
    }
  } else if (table === 'contact_requests' && type === 'INSERT' && record.status === 'pending') {
    job = {
      kind: 'request', recipientId: record.to_id, otherId: record.from_id,
      stillRelevant: async () => {
        const { data } = await supabaseAdmin.from('contact_requests').select('status').eq('id', record.id).maybeSingle()
        return data?.status === 'pending'
      },
      compose: name => ({
        subject: `${name} wants to share contact details on MusicianMap`,
        heading: `${name} sent you a contact request`,
        cta: 'See the request',
      }),
    }
  } else if (table === 'contact_requests' && type === 'UPDATE'
    && record.status === 'accepted' && old_record?.status !== 'accepted') {
    // Tell the person who asked; recipients see accepted contacts straight away
    job = {
      kind: 'accepted', recipientId: record.from_id, otherId: record.to_id,
      stillRelevant: async () => {
        const { data } = await supabaseAdmin.from('contact_requests').select('status').eq('id', record.id).maybeSingle()
        return data?.status === 'accepted'
      },
      compose: name => ({
        subject: `${name} accepted your contact request on MusicianMap`,
        heading: `${name} accepted your contact request. You can now see each other's contact details.`,
        cta: 'See their details',
      }),
    }
  }

  res.json({ ok: true, queued: !!job })
  if (!job) return
  // Waiting first means someone chatting live in the app doesn't also get an email.
  // A restart drops queued emails, which is acceptable for notifications.
  setTimeout(() => {
    deliverNotification(job)
      .then(outcome => console.log(`Notify ${job.kind} → ${job.recipientId}: ${outcome}`))
      .catch(err => console.error(`Notify ${job.kind} → ${job.recipientId} failed:`, err.message))
  }, NOTIFY_DELAY_MS)
})

// Unsubscribe link from the email footer (GET) and Gmail/Apple one-click unsubscribe (POST)
async function handleUnsubscribe(req, res) {
  const { u, t } = req.query
  const valid = process.env.NOTIFY_SECRET && supabaseAdmin && UUID_RE.test(String(u ?? ''))
    && secretsMatch(t, unsubscribeToken(String(u)))
  let ok = false
  if (valid) {
    const { error } = await supabaseAdmin
      .from('notification_settings')
      .upsert({ id: u, email_enabled: false, updated_at: new Date().toISOString() })
    ok = !error
  }
  if (req.method === 'POST') return res.status(ok ? 200 : 400).json({ ok })
  res.status(ok ? 200 : 400).type('html').send(`<!doctype html><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>MusicianMap emails</title>
<div style="font-family:Arial,sans-serif;max-width:420px;margin:48px auto;padding:0 16px;color:#111">
<p style="font-size:18px;font-weight:bold">${ok ? "You won't get any more emails from MusicianMap." : 'This unsubscribe link is not valid.'}</p>
<p style="font-size:14px">${ok ? 'You can turn them back on any time from your profile settings.' : 'You can turn emails off from your profile settings instead.'}</p>
<p><a href="${APP_URL}" style="color:#111">Back to MusicianMap</a></p></div>`)
}
app.get('/api/unsubscribe', handleUnsubscribe)
app.post('/api/unsubscribe', handleUnsubscribe)

// Railway healthcheck (railway.json)
app.get('/api/health', (_req, res) => res.json({ ok: true }))

// Unknown API paths get a JSON 404, not the SPA's index.html
app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }))

// Serve built frontend in production (Railway single-service deployment)
if (isProd) {
  // Vite hashes all filenames in /assets — safe to cache for a year
  app.use('/assets', express.static(join(__dirname, 'dist/assets'), {
    maxAge: '1y',
    immutable: true,
  }))
  // index.html must not be cached so deploys reach users immediately
  app.use(express.static(join(__dirname, 'dist'), {
    setHeaders(res, filePath) {
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
      }
    },
  }))
  // Static privacy policy (public/privacy.html); linked from Google's consent screen
  app.get('/privacy', (_req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
    res.sendFile(join(__dirname, 'dist', 'privacy.html'))
  })
  app.get('*', (_req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
    res.sendFile(join(__dirname, 'dist', 'index.html'))
  })
}

const PORT = process.env.PORT || process.env.API_PORT || 3001
app.listen(PORT, () => {
  console.log(`🎸 MusicianMap API running on http://localhost:${PORT}`)
  if (!supabaseAdmin) {
    console.warn('⚠️  Admin client not configured — set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local')
  }
})
