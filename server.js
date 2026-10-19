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

const CITIES = {
  newyork:     { label: 'New York',        lat: 40.7128,  lng: -74.0060  },
  losangeles:  { label: 'Los Angeles',     lat: 34.0522,  lng: -118.2437 },
  sfbay:       { label: 'San Francisco',   lat: 37.7749,  lng: -122.4194 },
  chicago:     { label: 'Chicago',         lat: 41.8781,  lng: -87.6298  },
  seattle:     { label: 'Seattle',         lat: 47.6062,  lng: -122.3321 },
  austin:      { label: 'Austin',          lat: 30.2672,  lng: -97.7431  },
  denver:      { label: 'Denver',          lat: 39.7392,  lng: -104.9903 },
  miami:       { label: 'Miami',           lat: 25.7617,  lng: -80.1918  },
  nashville:   { label: 'Nashville',       lat: 36.1627,  lng: -86.7816  },
  portland:    { label: 'Portland',        lat: 45.5051,  lng: -122.6750 },
  boston:      { label: 'Boston',          lat: 42.3601,  lng: -71.0589  },
  atlanta:     { label: 'Atlanta',         lat: 33.7490,  lng: -84.3880  },
}

const MOCK_TITLES = [
  'Guitarist looking for blues/rock band',
  'Drummer available for live gigs — 10+ yrs exp',
  'Singer/songwriter seeks backing band',
  'Bass player looking for jazz or funk group',
  'Piano player for hire — studio & live',
  'Heavy metal band needs lead guitarist',
  'Indie folk duo looking for cellist',
  'Vocalist seeks original music project',
  'Experienced drummer looking for serious band',
  'Keys + synth player — electronic/ambient',
  'Mandolin player — bluegrass or folk jams welcome',
  'Trumpet player available for jazz ensembles',
]

const MOCK_DESCRIPTIONS = [
  'Been playing for over 15 years. Influenced by Clapton, SRV, and Hendrix. Looking for like-minded musicians for weekly rehearsals and local gigs.',
  'Solid time-keeper with experience in multiple genres. Own kit, reliable transportation. Available weekends and evenings.',
  'I write original material in the folk/indie vein. Looking for musicians who want to create something original.',
  'Groove-oriented bass player. Influences include Jamerson, Jaco, and Flea. Let\'s make some music!',
  'Classically trained with a love for jazz and contemporary styles. Available for recording sessions and live performance.',
  'We\'re a 3-piece metal band with 5 originals ready. Need a shredder with equipment who can commit to regular practice.',
  'We perform original folk music and have several local shows lined up. Looking for a cellist to complete our sound.',
]

function generateMockPosts(city, cityId) {
  const spread = 0.10
  return MOCK_TITLES.map((title, i) => {
    const angle = (i / MOCK_TITLES.length) * 2 * Math.PI
    const r = spread * (0.4 + (i % 3) * 0.2)
    const daysAgo = Math.floor(Math.random() * 14)
    const pubDate = new Date(Date.now() - daysAgo * 86400000).toISOString()
    return {
      id: `mock-${cityId}-${i}`,
      title,
      description: MOCK_DESCRIPTIONS[i % MOCK_DESCRIPTIONS.length],
      url: `https://${cityId}.craigslist.org/search/muc`,
      lat: city.lat + Math.sin(angle) * r,
      lng: city.lng + Math.cos(angle) * r * 1.4,
      locationName: city.label,
      pubDate,
      city: city.label,
      cityId,
      isMock: true,
    }
  })
}

app.get('/api/cities', (_req, res) => {
  res.json(Object.entries(CITIES).map(([id, c]) => ({ id, ...c })))
})

app.get('/api/craigslist', async (req, res) => {
  const cityId = String(req.query.city || 'newyork').toLowerCase()
  const city = CITIES[cityId] ?? CITIES.newyork

  try {
    const { default: fetch } = await import('node-fetch')
    const url = `https://${cityId}.craigslist.org/search/muc?format=rss`

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
        Accept: 'application/rss+xml,application/xml,text/xml,*/*',
      },
      signal: AbortSignal.timeout(12000),
    })

    if (!response.ok) {
      console.log(`[Craigslist] ${cityId} returned HTTP ${response.status}, using mock data`)
      return res.json({ posts: generateMockPosts(city, cityId), error: 'Craigslist blocked access — showing sample posts' })
    }

    const xml = await response.text()
    const { XMLParser } = await import('fast-xml-parser')
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      allowBooleanAttributes: true,
    })
    const parsed = parser.parse(xml)
    const rawItems = parsed?.rss?.channel?.item

    if (!rawItems) {
      return res.json({ posts: [] })
    }

    const items = Array.isArray(rawItems) ? rawItems : [rawItems]
    const spread = 0.12

    const posts = items.slice(0, 30).map((item, i) => {
      let lat = item['geo:lat'] ? parseFloat(item['geo:lat']) : null
      let lng = item['geo:long'] ? parseFloat(item['geo:long']) : null

      if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
        // Scatter around city center so pins don't overlap
        const angle = (i / 30) * 2 * Math.PI + Math.random() * 0.5
        const r = spread * (0.3 + Math.random() * 0.7)
        lat = city.lat + Math.sin(angle) * r
        lng = city.lng + Math.cos(angle) * r * 1.3
      }

      const rawDesc = String(item.description || '')
      const cleanDesc = rawDesc.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()

      return {
        id: String(item.guid?.['#text'] || item.guid || item.link || `${cityId}-${i}`),
        title: String(item.title || 'Untitled Post'),
        description: cleanDesc.slice(0, 300) + (cleanDesc.length > 300 ? '…' : ''),
        url: String(item.link || ''),
        lat,
        lng,
        locationName: item['x-format:location'] || city.label,
        pubDate: item.pubDate || new Date().toISOString(),
        city: city.label,
        cityId,
      }
    })

    res.json({ posts })
  } catch (err) {
    console.error(`[Craigslist] ${cityId}:`, err.message)
    res.json({ posts: generateMockPosts(city, cityId), error: 'Craigslist blocked access — showing sample posts' })
  }
})

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
  app.use(express.static(join(__dirname, 'dist')))
  app.get('*', (_req, res) => {
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
