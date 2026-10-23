#!/usr/bin/env node
// Sets animated Pokémon GIF avatars on all test/seed profiles.
// Run: node scripts/update-avatars.js
// Sprites are Gen V animated GIFs from the PokeAPI sprite repository.

import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { createClient } from '@supabase/supabase-js'

const __dir = dirname(fileURLToPath(import.meta.url))
const envRaw = readFileSync(join(__dir, '../.env.local'), 'utf-8')
const env = Object.fromEntries(
  envRaw.split('\n')
    .filter(l => l.trim() && !l.startsWith('#') && l.includes('='))
    .map(l => { const idx = l.indexOf('='); return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()] })
)

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const sprite = (id) =>
  `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated/${id}.gif`

// Handpicked Pokémon matched loosely to each musician's vibe
const AVATAR_MAP = {
  'maya.chen@musicianmap.test':     sprite(196),  // Espeon       — elegant psychic cat
  'darius.knight@musicianmap.test': sprite(135),  // Jolteon      — electric energy, Chicago blues
  'sarah.flores@musicianmap.test':  sprite(179),  // Mareep       — soft country sheep
  'tom.okafor@musicianmap.test':    sprite(237),  // Hitmontop    — spinning, percussive
  'elena.vasquez@musicianmap.test': sprite(38),   // Ninetales    — graceful fox, classical
  'jake.morrison@musicianmap.test': sprite(94),   // Gengar       — funky, producer energy
  'priya.nair@musicianmap.test':    sprite(350),  // Milotic      — elegant, jazz/Latin
  'ben.walsh@musicianmap.test':     sprite(133),  // Eevee        — folk-rock, versatile

  'test-alex@musicianmap.test':     sprite(6),    // Charizard    — rock guitarist energy
  'test-sarah@musicianmap.test':    sprite(197),  // Umbreon      — sleek violinist
  'test-marcus@musicianmap.test':   sprite(448),  // Lucario      — powerful drummer
  'test-elena@musicianmap.test':    sprite(35),   // Clefairy     — pop/R&B, cute
  'test-diego@musicianmap.test':    sprite(260),  // Swampert     — funky bassist
  'test-priya@musicianmap.test':    sprite(251),  // Celebi       — mystical jazz pianist
  'test-jake@musicianmap.test':     sprite(263),  // Zigzagoon    — banjo-playing wanderer
  'test-aisha@musicianmap.test':    sprite(249),  // Lugia        — majestic saxophonist
  'test-connor@musicianmap.test':   sprite(333),  // Swablu       — dreamy shoegaze guitarist
  'test-yuki@musicianmap.test':     sprite(474),  // Porygon-Z    — electronic producer
  'test-maria@musicianmap.test':    sprite(281),  // Kirlia       — flutist, graceful
  'test-tobias@musicianmap.test':   sprite(245),  // Suicune      — classical trumpeter
  'test-ingrid@musicianmap.test':   sprite(144),  // Articuno     — cellist, Scandinavian cool
  'test-kwame@musicianmap.test':    sprite(395),  // Empoleon     — ATL hip-hop producer
  'test-rosa@musicianmap.test':     sprite(39),   // Jigglypuff  — ukulele singer!
  'test-ivan@musicianmap.test':     sprite(111),  // Rhyhorn      — blues harmonica, rough
  'test-fatima@musicianmap.test':   sprite(468),  // Togekiss     — mandolin, world music
  'test-tyler@musicianmap.test':    sprite(559),  // Scraggy      — punk guitarist
  'test-mei@musicianmap.test':      sprite(488),  // Cresselia    — elegant pop keyboardist
  'test-omar@musicianmap.test':     sprite(248),  // Tyranitar    — metal bassist
}

async function main() {
  // Fetch all test profiles
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, email')
    .eq('is_test', true)

  if (error) { console.error('Error fetching profiles:', error.message); process.exit(1) }

  let updated = 0
  let skipped = 0

  for (const p of profiles) {
    const avatarUrl = AVATAR_MAP[p.email]
    if (!avatarUrl) { console.log(`  no avatar mapping for ${p.email}`); skipped++; continue }

    const { error: updateErr } = await supabase
      .from('profiles')
      .update({ avatar_url: avatarUrl })
      .eq('id', p.id)

    if (updateErr) {
      console.error(`  ERROR updating ${p.email}:`, updateErr.message)
    } else {
      console.log(`  updated ${p.email}`)
      updated++
    }
  }

  console.log(`\nDone: ${updated} updated, ${skipped} skipped.`)
}

main().catch(err => { console.error(err); process.exit(1) })
