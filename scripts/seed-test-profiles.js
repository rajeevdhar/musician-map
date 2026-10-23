#!/usr/bin/env node
// Creates 20 fake test profiles in Supabase (auth users + profile rows).
// Run: node scripts/seed-test-profiles.js
// Safe to re-run — skips emails that already exist.

import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { createClient } from '@supabase/supabase-js'

const __dir = dirname(fileURLToPath(import.meta.url))
const envRaw = readFileSync(join(__dir, '../.env.local'), 'utf-8')
const env = Object.fromEntries(
  envRaw.split('\n')
    .filter(l => l.trim() && !l.startsWith('#') && l.includes('='))
    .map(l => {
      const idx = l.indexOf('=')
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()]
    })
)

const supabaseUrl = env.SUPABASE_URL
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY
if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const now = new Date()
const daysAgo = (d) => new Date(now.getTime() - d * 86_400_000).toISOString()

const PROFILES = [
  // Original seed musicians (formerly hard-coded client-side)
  {
    email: 'maya.chen@musicianmap.test',
    displayName: 'Maya Chen',
    bio: 'Jazz pianist and composer. Gigging around the Bay Area for 8 years. Influenced by Thelonious Monk and Brad Mehldau.',
    instruments: ['Keyboard / Piano'],
    primaryInstrument: 'Keyboard / Piano',
    genres: ['Jazz', 'Blues'],
    lookingFor: 'Band Members,Recording Collaborator',
    level: 'Advanced',
    lat: 37.7749, lng: -122.4194,
    locationName: 'San Francisco, CA',
    yearsPlaying: 8,
    lastSeenAt: daysAgo(30),
  },
  {
    email: 'darius.knight@musicianmap.test',
    displayName: 'Darius Knight',
    bio: 'Blues guitarist and vocalist. 15 years on the Chicago circuit. Own a PA and a van — ready to gig anywhere.',
    instruments: ['Guitar', 'Vocals'],
    primaryInstrument: 'Guitar',
    genres: ['Blues', 'Rock', 'R&B / Soul'],
    lookingFor: 'Band Members,Live Gigs',
    level: 'Pro',
    lat: 41.8781, lng: -87.6298,
    locationName: 'Chicago, IL',
    yearsPlaying: 15,
    lastSeenAt: daysAgo(21),
  },
  {
    email: 'sarah.flores@musicianmap.test',
    displayName: 'Sarah Flores',
    bio: 'Country/Americana vocalist and acoustic guitarist. Songwriter with two indie albums out. Looking for a solid rhythm section.',
    instruments: ['Vocals', 'Guitar'],
    primaryInstrument: 'Vocals',
    genres: ['Country', 'Folk / Acoustic'],
    lookingFor: 'Band Members,Live Gigs',
    level: 'Advanced',
    lat: 36.1627, lng: -86.7816,
    locationName: 'Nashville, TN',
    yearsPlaying: 10,
    lastSeenAt: daysAgo(14),
  },
  {
    email: 'tom.okafor@musicianmap.test',
    displayName: 'Tom Okafor',
    bio: 'Session drummer with studio experience. Comfortable in any genre but love playing funk and hip-hop. Available for hire.',
    instruments: ['Drums'],
    primaryInstrument: 'Drums',
    genres: ['Funk', 'Hip-Hop / Rap', 'R&B / Soul', 'Jazz'],
    lookingFor: 'Session Work,Band Members',
    level: 'Pro',
    lat: 34.0522, lng: -118.2437,
    locationName: 'Los Angeles, CA',
    yearsPlaying: 12,
    lastSeenAt: daysAgo(10),
  },
  {
    email: 'elena.vasquez@musicianmap.test',
    displayName: 'Elena Vasquez',
    bio: 'Classically trained violinist crossing into indie and folk. Looking for collaborative projects that blend acoustic and electric textures.',
    instruments: ['Violin'],
    primaryInstrument: 'Violin',
    genres: ['Classical', 'Indie', 'Folk / Acoustic'],
    lookingFor: 'Band Members,Recording Collaborator',
    level: 'Advanced',
    lat: 47.6062, lng: -122.3321,
    locationName: 'Seattle, WA',
    yearsPlaying: 12,
    lastSeenAt: daysAgo(5),
  },
  {
    email: 'jake.morrison@musicianmap.test',
    displayName: 'Jake Morrison',
    bio: 'Bass player and music producer. Deep in the Austin scene for 6 years. Into everything from Afrobeat to metal — versatile and reliable.',
    instruments: ['Bass', 'DJ / Producer'],
    primaryInstrument: 'Bass',
    genres: ['Rock', 'Electronic / EDM', 'Funk', 'Alternative'],
    lookingFor: 'Band Members,Jam Partner,Recording Collaborator',
    level: 'Advanced',
    lat: 30.2672, lng: -97.7431,
    locationName: 'Austin, TX',
    yearsPlaying: 6,
    lastSeenAt: daysAgo(7),
  },
  {
    email: 'priya.nair@musicianmap.test',
    displayName: 'Priya Nair',
    bio: 'Saxophonist with a love for jazz fusion and Latin music. Originally from Miami, now gigging locally and doing studio sessions.',
    instruments: ['Saxophone'],
    primaryInstrument: 'Saxophone',
    genres: ['Jazz', 'Latin', 'R&B / Soul'],
    lookingFor: 'Band Members,Session Work,Jam Partner',
    level: 'Intermediate',
    lat: 25.7617, lng: -80.1918,
    locationName: 'Miami, FL',
    yearsPlaying: 7,
    lastSeenAt: daysAgo(3),
  },
  {
    email: 'ben.walsh@musicianmap.test',
    displayName: 'Ben Walsh',
    bio: 'Singer-songwriter and acoustic guitarist. Performing original folk-rock in the Denver area. Looking for a co-writer or a full band.',
    instruments: ['Guitar', 'Vocals', 'Harmonica'],
    primaryInstrument: 'Guitar',
    genres: ['Folk / Acoustic', 'Rock', 'Alternative'],
    lookingFor: 'Band Members,Recording Collaborator,Just Meeting Other Musicians',
    level: 'Intermediate',
    lat: 39.7392, lng: -104.9903,
    locationName: 'Denver, CO',
    yearsPlaying: 6,
    lastSeenAt: daysAgo(2),
  },

  // Online now
  {
    email: 'test-alex@musicianmap.test',
    displayName: 'Alex Rivera',
    bio: 'Rock guitarist with 12 years experience. Love everything from classic rock to modern metal. Looking for a band for live gigs.',
    instruments: ['Guitar'],
    primaryInstrument: 'Guitar',
    genres: ['Rock', 'Metal'],
    lookingFor: 'Band Members,Live Gigs',
    level: 'Pro',
    lat: 34.0522, lng: -118.2437,
    locationName: 'Los Angeles, CA',
    yearsPlaying: 12,
    lastSeenAt: now.toISOString(),
  },
  {
    email: 'test-sarah@musicianmap.test',
    displayName: 'Sarah Chen',
    bio: 'Classical violinist exploring jazz and chamber music. Available for session work and ensemble gigs.',
    instruments: ['Violin'],
    primaryInstrument: 'Violin',
    genres: ['Classical', 'Jazz'],
    lookingFor: 'Session Work,Recording Collaborator',
    level: 'Advanced',
    lat: 40.7128, lng: -74.0060,
    locationName: 'New York, NY',
    yearsPlaying: 15,
    lastSeenAt: now.toISOString(),
  },
  {
    email: 'test-marcus@musicianmap.test',
    displayName: 'Marcus Johnson',
    bio: 'Professional drummer with studio and touring experience. Hip-hop and R&B specialist, open to all genres.',
    instruments: ['Drums'],
    primaryInstrument: 'Drums',
    genres: ['Hip-Hop / Rap', 'R&B / Soul'],
    lookingFor: 'Band Members,Session Work',
    level: 'Pro',
    lat: 41.8781, lng: -87.6298,
    locationName: 'Chicago, IL',
    yearsPlaying: 10,
    lastSeenAt: now.toISOString(),
  },
  {
    email: 'test-elena@musicianmap.test',
    displayName: 'Elena Kowalski',
    bio: 'Singer-songwriter with a pop and R&B background. Writing originals and looking for collaborators.',
    instruments: ['Vocals'],
    primaryInstrument: 'Vocals',
    genres: ['Pop', 'R&B / Soul'],
    lookingFor: 'Recording Collaborator,Band Members',
    level: 'Intermediate',
    lat: 25.7617, lng: -80.1918,
    locationName: 'Miami, FL',
    yearsPlaying: 7,
    lastSeenAt: now.toISOString(),
  },
  {
    email: 'test-diego@musicianmap.test',
    displayName: 'Diego Ramirez',
    bio: 'Funky bass player with reggae and funk roots. Loves groove-heavy music and wants to find a tight band.',
    instruments: ['Bass'],
    primaryInstrument: 'Bass',
    genres: ['Reggae', 'Funk'],
    lookingFor: 'Band Members,Jam Partner',
    level: 'Advanced',
    lat: 29.7604, lng: -95.3698,
    locationName: 'Houston, TX',
    yearsPlaying: 9,
    lastSeenAt: now.toISOString(),
  },

  // 1 day ago
  {
    email: 'test-priya@musicianmap.test',
    displayName: 'Priya Patel',
    bio: 'Jazz pianist and classical composer. I teach lessons and perform locally. Open to collaborative compositions.',
    instruments: ['Keyboard / Piano'],
    primaryInstrument: 'Keyboard / Piano',
    genres: ['Jazz', 'Classical'],
    lookingFor: 'Lessons / Teaching,Recording Collaborator',
    level: 'Pro',
    lat: 37.7749, lng: -122.4194,
    locationName: 'San Francisco, CA',
    yearsPlaying: 20,
    lastSeenAt: daysAgo(1),
  },
  {
    email: 'test-jake@musicianmap.test',
    displayName: 'Jake Thompson',
    bio: 'Banjo player steeped in bluegrass and old-time. Looking for a bluegrass band or jam nights.',
    instruments: ['Banjo'],
    primaryInstrument: 'Banjo',
    genres: ['Folk / Acoustic', 'Country'],
    lookingFor: 'Band Members,Jam Partner',
    level: 'Intermediate',
    lat: 36.1627, lng: -86.7816,
    locationName: 'Nashville, TN',
    yearsPlaying: 5,
    lastSeenAt: daysAgo(1),
  },

  // 3 days ago
  {
    email: 'test-aisha@musicianmap.test',
    displayName: 'Aisha Williams',
    bio: 'Alto sax player with a jazz and blues background. Regular at local jam sessions, always up for new projects.',
    instruments: ['Saxophone'],
    primaryInstrument: 'Saxophone',
    genres: ['Jazz', 'Blues'],
    lookingFor: 'Jam Partner,Live Gigs',
    level: 'Advanced',
    lat: 29.9511, lng: -90.0715,
    locationName: 'New Orleans, LA',
    yearsPlaying: 11,
    lastSeenAt: daysAgo(3),
  },
  {
    email: 'test-connor@musicianmap.test',
    displayName: 'Connor MacPherson',
    bio: 'Self-taught indie guitarist picking up steam. Really into shoegaze and dream pop. Looking for bandmates who vibe with that.',
    instruments: ['Guitar'],
    primaryInstrument: 'Guitar',
    genres: ['Alternative', 'Indie'],
    lookingFor: 'Band Members,Jam Partner',
    level: 'Beginner',
    lat: 47.6062, lng: -122.3321,
    locationName: 'Seattle, WA',
    yearsPlaying: 2,
    lastSeenAt: daysAgo(3),
  },
  {
    email: 'test-yuki@musicianmap.test',
    displayName: 'Yuki Tanaka',
    bio: 'Electronic music producer and synthesizer nerd. Deep into modular synthesis and ambient textures.',
    instruments: ['Synthesizer', 'DJ / Producer'],
    primaryInstrument: 'Synthesizer',
    genres: ['Electronic / EDM', 'Alternative'],
    lookingFor: 'Recording Collaborator,Jam Partner',
    level: 'Advanced',
    lat: 39.7392, lng: -104.9903,
    locationName: 'Denver, CO',
    yearsPlaying: 8,
    lastSeenAt: daysAgo(3),
  },

  // 7 days ago
  {
    email: 'test-maria@musicianmap.test',
    displayName: 'Maria Santos',
    bio: 'Flutist with classical training and a love for Latin music. Teaches privately and performs in local orchestras.',
    instruments: ['Flute'],
    primaryInstrument: 'Flute',
    genres: ['Classical', 'Latin'],
    lookingFor: 'Lessons / Teaching,Session Work',
    level: 'Intermediate',
    lat: 29.4241, lng: -98.4936,
    locationName: 'San Antonio, TX',
    yearsPlaying: 14,
    lastSeenAt: daysAgo(7),
  },
  {
    email: 'test-tobias@musicianmap.test',
    displayName: 'Tobias Müller',
    bio: 'Trumpet player with a classical conservatory background. Now playing jazz and experimenting with fusion.',
    instruments: ['Trumpet'],
    primaryInstrument: 'Trumpet',
    genres: ['Jazz', 'Classical'],
    lookingFor: 'Band Members,Session Work',
    level: 'Pro',
    lat: 42.3601, lng: -71.0589,
    locationName: 'Boston, MA',
    yearsPlaying: 18,
    lastSeenAt: daysAgo(7),
  },
  {
    email: 'test-ingrid@musicianmap.test',
    displayName: 'Ingrid Larsson',
    bio: 'Cellist trained in Scandinavia, now living in Minneapolis. Looking for chamber music ensembles and orchestral projects.',
    instruments: ['Cello'],
    primaryInstrument: 'Cello',
    genres: ['Classical'],
    lookingFor: 'Band Members,Recording Collaborator',
    level: 'Advanced',
    lat: 44.9778, lng: -93.2650,
    locationName: 'Minneapolis, MN',
    yearsPlaying: 22,
    lastSeenAt: daysAgo(7),
  },

  // 14 days ago
  {
    email: 'test-kwame@musicianmap.test',
    displayName: 'Kwame Asante',
    bio: 'Producer and DJ with 10 years in the ATL hip-hop scene. Looking for vocalists and live instrumentalists to collaborate with.',
    instruments: ['DJ / Producer'],
    primaryInstrument: 'DJ / Producer',
    genres: ['Hip-Hop / Rap', 'Electronic / EDM'],
    lookingFor: 'Recording Collaborator,Band Members',
    level: 'Pro',
    lat: 33.7490, lng: -84.3880,
    locationName: 'Atlanta, GA',
    yearsPlaying: 10,
    lastSeenAt: daysAgo(14),
  },
  {
    email: 'test-rosa@musicianmap.test',
    displayName: 'Rosa Martinez',
    bio: 'Just picked up the ukulele during the pandemic and fell in love with it. Looking for low-key jam sessions.',
    instruments: ['Ukulele'],
    primaryInstrument: 'Ukulele',
    genres: ['Folk / Acoustic', 'Pop'],
    lookingFor: 'Jam Partner,Just Meeting Other Musicians',
    level: 'Beginner',
    lat: 45.5051, lng: -122.6750,
    locationName: 'Portland, OR',
    yearsPlaying: 1,
    lastSeenAt: daysAgo(14),
  },
  {
    email: 'test-ivan@musicianmap.test',
    displayName: 'Ivan Petrov',
    bio: 'Blues harmonica player inspired by Little Walter and Sonny Boy Williamson. Plays at local bars and open mics.',
    instruments: ['Harmonica'],
    primaryInstrument: 'Harmonica',
    genres: ['Blues', 'Folk / Acoustic'],
    lookingFor: 'Jam Partner,Live Gigs',
    level: 'Intermediate',
    lat: 42.3314, lng: -83.0458,
    locationName: 'Detroit, MI',
    yearsPlaying: 6,
    lastSeenAt: daysAgo(14),
  },

  // 30 days ago
  {
    email: 'test-fatima@musicianmap.test',
    displayName: 'Fatima Al-Hassan',
    bio: 'Mandolin player with roots in Celtic and Middle Eastern folk traditions. Interested in world music fusion.',
    instruments: ['Mandolin'],
    primaryInstrument: 'Mandolin',
    genres: ['Folk / Acoustic'],
    lookingFor: 'Band Members,Recording Collaborator',
    level: 'Intermediate',
    lat: 30.2672, lng: -97.7431,
    locationName: 'Austin, TX',
    yearsPlaying: 8,
    lastSeenAt: daysAgo(30),
  },
  {
    email: 'test-tyler@musicianmap.test',
    displayName: 'Tyler Brooks',
    bio: 'Punk and hardcore guitarist, been playing for about a year. Raw energy over technical skill. Looking for a punk band.',
    instruments: ['Guitar'],
    primaryInstrument: 'Guitar',
    genres: ['Punk', 'Rock'],
    lookingFor: 'Band Members',
    level: 'Beginner',
    lat: 39.9526, lng: -75.1652,
    locationName: 'Philadelphia, PA',
    yearsPlaying: 1,
    lastSeenAt: daysAgo(30),
  },
  {
    email: 'test-mei@musicianmap.test',
    displayName: 'Mei Lin',
    bio: 'Pop and R&B keyboardist with strong ear training background. Can play by ear and sight-read. Studio session work welcome.',
    instruments: ['Keyboard / Piano'],
    primaryInstrument: 'Keyboard / Piano',
    genres: ['Pop', 'R&B / Soul'],
    lookingFor: 'Session Work,Live Gigs',
    level: 'Advanced',
    lat: 32.7767, lng: -96.7970,
    locationName: 'Dallas, TX',
    yearsPlaying: 13,
    lastSeenAt: daysAgo(30),
  },
  {
    email: 'test-omar@musicianmap.test',
    displayName: 'Omar Abdullah',
    bio: 'Metal bassist with a love of progressive and djent. Tight grooves, complex time signatures, no compromise.',
    instruments: ['Bass'],
    primaryInstrument: 'Bass',
    genres: ['Metal', 'Rock'],
    lookingFor: 'Band Members',
    level: 'Pro',
    lat: 33.4484, lng: -112.0740,
    locationName: 'Phoenix, AZ',
    yearsPlaying: 11,
    lastSeenAt: daysAgo(30),
  },
]

async function main() {
  let created = 0
  let skipped = 0

  for (const p of PROFILES) {
    // Check if auth user already exists
    const { data: existing } = await supabase.auth.admin.listUsers()
    const alreadyExists = existing?.users?.some(u => u.email === p.email)

    if (alreadyExists) {
      console.log(`  skip  ${p.email}`)
      skipped++
      continue
    }

    // Create auth user
    const { data: userData, error: userErr } = await supabase.auth.admin.createUser({
      email: p.email,
      password: 'TestProfile2025!',
      email_confirm: true,
    })

    if (userErr || !userData.user) {
      console.error(`  ERROR creating ${p.email}:`, userErr?.message)
      continue
    }

    const userId = userData.user.id

    // Insert profile
    const { error: profileErr } = await supabase.from('profiles').insert({
      id: userId,
      email: p.email,
      display_name: p.displayName,
      bio: p.bio,
      instruments: p.instruments,
      genres: p.genres,
      contact_email: p.email,
      lat: p.lat,
      lng: p.lng,
      location_name: p.locationName,
      location_precision: 'exact',
      looking_for: p.lookingFor,
      level: p.level,
      primary_instrument: p.primaryInstrument,
      years_playing: p.yearsPlaying,
      last_seen_at: p.lastSeenAt,
      is_test: true,
    })

    if (profileErr) {
      console.error(`  ERROR inserting profile for ${p.email}:`, profileErr.message)
      // Clean up auth user if profile insert failed
      await supabase.auth.admin.deleteUser(userId)
      continue
    }

    console.log(`  created ${p.displayName} (${p.email})`)
    created++
  }

  console.log(`\nDone: ${created} created, ${skipped} skipped.`)
}

main().catch(err => { console.error(err); process.exit(1) })
