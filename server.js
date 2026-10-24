import { config } from 'dotenv'
config({ path: '.env.local' })

import express from 'express'
import cors from 'cors'
import { createClient } from '@supabase/supabase-js'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const isProd = process.env.NODE_ENV === 'production'

const supabaseAdmin = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null

// Verify the JWT belongs to a real user; also check admin email for privileged routes
async function verifyJwt(req) {
  const token = req.headers.authorization?.split(' ')[1]
  if (!token || !supabaseAdmin) return null
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
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

// ── Self-delete: user deletes their own account ───────────────────────────────
app.delete('/api/self-delete', async (req, res) => {
  const user = await verifyJwt(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })
  if (!supabaseAdmin) return res.status(503).json({ error: 'Admin client not configured' })
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

// Admin: update any profile (bypasses RLS via service role)
app.patch('/api/admin/profile/:id', requireAdmin, async (req, res) => {
  if (!supabaseAdmin) return res.status(503).json({ error: 'Admin client not configured' })
  const allowed = ['display_name','bio','instruments','genres','lat','lng','location_name','looking_for','website_url','instagram_url','youtube_url','soundcloud_url','bandcamp_url','tiktok_url','discord_url']
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
  const { error } = await supabaseAdmin.auth.admin.deleteUser(req.params.id)
  if (error) return res.status(500).json({ error: error.message })
  res.json({ ok: true })
})

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
