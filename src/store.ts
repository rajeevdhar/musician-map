import { create } from 'zustand'
import type { User } from '@supabase/supabase-js'
import { supabase, landedFromSignupLink } from './lib/supabase'
import type { Musician, Level, Message, ContactRequestStatus } from './types'
import { haversineDistanceMiles } from './lib/musicianUtils'
import { isOnline } from './lib/presence'
import { PUBLIC_PROFILE_COLUMNS } from './lib/profileColumns'
import { removeOwnFiles } from './lib/storageCleanup'

export interface Filters {
  instruments: string[]
  genres: string[]
  levels: Level[]
  lookingFor: string[]
  distanceMi: 1 | 5 | 10 | 25 | 50 | 100 | 0
  onlineOnly: boolean
}

const DEFAULT_FILTERS: Filters = {
  instruments: [],
  genres: [],
  levels: [],
  lookingFor: [],
  distanceMi: 25,
  onlineOnly: false,
}

// ── Realtime channel ───────────────────────────────────────────────────────
let realtimeChannel: ReturnType<typeof supabase.channel> | null = null

// ── Presence heartbeat ─────────────────────────────────────────────────────
// Writes profiles.last_seen_at every 240s while signed in, and mirrors the
// timestamp into local state so the user's own dot turns green immediately
// instead of waiting for (or being overwritten by) a stale profiles fetch.
let heartbeatTimer: ReturnType<typeof setInterval> | null = null
let heartbeatUserId: string | null = null
let lastPingIso: string | null = null

function applyOwnPing(userId: string, iso: string) {
  useStore.setState(s => ({
    musicians: s.musicians.map(m => (m.id === userId ? { ...m, lastSeenAt: iso } : m)),
  }))
}

function startHeartbeat(userId: string): Promise<void> {
  if (heartbeatTimer) clearInterval(heartbeatTimer)
  heartbeatUserId = userId
  const ping = async () => {
    const iso = new Date().toISOString()
    const { error } = await supabase
      .from('profiles')
      .update({ last_seen_at: iso })
      .eq('id', userId)
    if (error) {
      console.warn('Heartbeat failed:', error.message)
      return
    }
    lastPingIso = iso
    applyOwnPing(userId, iso)
  }
  heartbeatTimer = setInterval(ping, 240_000)
  return ping()
}
function stopHeartbeat() {
  if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null }
  heartbeatUserId = null
  lastPingIso = null
}

// Periodically re-fetch profiles so everyone else's online status stays current.
let refreshTimer: ReturnType<typeof setInterval> | null = null
function startProfileRefresh(refresh: () => void) {
  if (refreshTimer) return
  refreshTimer = setInterval(() => {
    if (document.visibilityState === 'visible') refresh()
  }, 60_000)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refresh()
  })
}

function newerIso(a?: string, b?: string): string | undefined {
  if (!a) return b
  if (!b) return a
  return new Date(a).getTime() >= new Date(b).getTime() ? a : b
}


export interface AppUser {
  id: string
  email: string
  displayName: string
}

// Email sign-up stores `displayName`; Google sends `full_name` / `name`. The last
// fallback avoids publishing the full email address as someone's display name.
function toAppUser(u: User): AppUser {
  const meta = u.user_metadata ?? {}
  return {
    id: u.id,
    email: u.email!,
    displayName: meta.displayName ?? meta.full_name ?? meta.name ?? u.email!.split('@')[0],
  }
}

// Set before redirecting to Google or signing up by email, so when the user lands back
// signed in the app knows this may be a brand-new account that still needs onboarding.
// The confirmation link often opens in a different browser (mail app, phone), where this
// flag doesn't exist, so landing from that link counts too.
const ONBOARD_PENDING_KEY = 'mm-onboard-pending'
let signupLinkPending = landedFromSignupLink

function markOnboardPending() {
  try { localStorage.setItem(ONBOARD_PENDING_KEY, '1') } catch { /* onboarding just won't auto-open */ }
}

export function consumeOnboardPending(): boolean {
  const fromLink = signupLinkPending
  signupLinkPending = false
  try {
    const pending = localStorage.getItem(ONBOARD_PENDING_KEY) !== null
    localStorage.removeItem(ONBOARD_PENDING_KEY)
    return pending || fromLink
  } catch { return fromLink }
}

interface AppStore {
  // ── Auth ──────────────────────────────────────────────────────────────────
  currentUser: AppUser | null
  isAuthReady: boolean
  needsPasswordReset: boolean
  initAuth: () => void
  register: (email: string, password: string, displayName: string) => Promise<{ ok: boolean; needsConfirmation?: boolean; error?: string }>
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>
  loginWithGoogle: (idToken: string, nonce: string) => Promise<{ ok: boolean; error?: string }>
  logout: () => Promise<void>

  // ── Musician profiles ─────────────────────────────────────────────────────
  musicians: Musician[]
  fetchMusicians: () => Promise<void>
  saveProfile: (profile: Omit<Musician, 'id' | 'email' | 'createdAt'>) => Promise<{ ok: boolean; error?: string }>
  currentProfile: () => Musician | undefined
  removeProfile: () => Promise<void>
  deleteAccount: () => Promise<boolean>

  // ── Layout & search ───────────────────────────────────────────────────────
  selectedId: string | null
  query: string
  searchLoc: { lat: number; lng: number } | null
  activeTab: 'map' | 'list' | 'saved' | 'messages' | 'me'
  filters: Filters
  showFilterPanel: boolean
  setSelectedId: (id: string | null) => void
  setQuery: (q: string) => void
  setSearchLoc: (loc: { lat: number; lng: number } | null) => void
  setActiveTab: (tab: AppStore['activeTab']) => void
  setFilters: (partial: Partial<Filters>) => void
  resetFilters: () => void
  setShowFilterPanel: (show: boolean) => void
  filterCount: () => number
  searchOrigin: () => { lat: number; lng: number } | null
  filteredMusicians: () => Musician[]

  // ── Saved ─────────────────────────────────────────────────────────────────
  saved: Record<string, string>
  fetchSaved: () => Promise<void>
  toggleSaved: (musicianId: string) => Promise<void>
  updateNote: (musicianId: string, note: string) => Promise<void>

  // ── Messages ──────────────────────────────────────────────────────────────
  threads: Record<string, Message[]>
  unread: Record<string, boolean>
  activeThreadId: string | null
  fetchThreads: () => Promise<void>
  sendMessage: (toId: string, body: string) => Promise<void>
  markThreadRead: (userId: string) => Promise<void>
  setActiveThreadId: (id: string | null) => void

  // ── Blocking ──────────────────────────────────────────────────────────────
  // Users I've blocked. RLS stops messages/requests both ways and hides my profile
  // from them; hiding them from me is done here, so their name stays available
  // (blockedProfiles) for the Blocked musicians list.
  blocked: Record<string, true>
  blockedProfiles: Record<string, Pick<Musician, 'displayName' | 'avatarUrl'>>
  blockUser: (userId: string) => Promise<boolean>
  unblockUser: (userId: string) => Promise<void>

  // ── Contact requests ──────────────────────────────────────────────────────
  contactRequests: {
    outgoing: Record<string, ContactRequestStatus>
    incoming: Record<string, 'pending'>
  }
  revealedContacts: Record<string, { email: string; phone?: string }>
  fetchContactRequests: () => Promise<void>
  requestContact: (musicianId: string) => Promise<void>
  respondToContactRequest: (fromId: string, accept: boolean) => Promise<void>
  initMessages: () => Promise<void>
  unreadCount: () => number

  // ── Toast ─────────────────────────────────────────────────────────────────
  toast: string | null
  showToast: (msg: string) => void
}

export const useStore = create<AppStore>()((set, get) => ({
  // ── Auth ─────────────────────────────────────────────────────────────────
  currentUser: null,
  isAuthReady: false,
  needsPasswordReset: false,

  initAuth: () => {
    // Restore existing session, then listen for future changes
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const u = session.user
        set({
          currentUser: toAppUser(u),
          isAuthReady: true,
        })
        // Fetch after the first heartbeat lands so we don't read a stale last_seen_at
        startHeartbeat(u.id).finally(() => {
          get().fetchMusicians()
          get().initMessages()
        })
      } else {
        set({ isAuthReady: true })
        get().fetchMusicians()
      }
      startProfileRefresh(() => get().fetchMusicians())
    })

    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' && session?.user) {
        const u = session.user
        set({
          needsPasswordReset: true,
          currentUser: toAppUser(u),
        })
        startHeartbeat(u.id).finally(() => get().fetchMusicians())
      } else if ((event === 'SIGNED_IN' || event === 'USER_UPDATED') && session?.user) {
        const u = session.user
        set({
          currentUser: toAppUser(u),
        })
        startHeartbeat(u.id).finally(() => {
          get().fetchMusicians()
          get().initMessages()
        })
      } else if (event === 'SIGNED_OUT') {
        stopHeartbeat()
        if (realtimeChannel) { supabase.removeChannel(realtimeChannel); realtimeChannel = null }
        set({
          currentUser: null,
          needsPasswordReset: false,
          saved: {},
          threads: {},
          unread: {},
          activeThreadId: null,
          contactRequests: { outgoing: {}, incoming: {} },
          revealedContacts: {},
          blocked: {},
          blockedProfiles: {},
        })
        get().fetchMusicians()
      }
    })
  },

  // With "Confirm email" on, signUp returns no session: the user must click the emailed
  // link first, which lands them back here signed in.
  register: async (email, password, displayName) => {
    markOnboardPending()
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { displayName }, emailRedirectTo: window.location.origin },
    })
    if (error) { consumeOnboardPending(); return { ok: false, error: error.message } }
    return { ok: true, needsConfirmation: !data.session }
  },

  login: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  },

  // Redirects away to Google; the session is picked up from the URL on return
  // ID token from Google's own button (lib/googleIdentity.ts); no redirect, so the
  // SIGNED_IN event that follows is what opens onboarding for a new account
  loginWithGoogle: async (idToken, nonce) => {
    markOnboardPending()
    const { error } = await supabase.auth.signInWithIdToken({ provider: 'google', token: idToken, nonce })
    if (error) { consumeOnboardPending(); return { ok: false, error: error.message } }
    return { ok: true }
  },

  logout: async () => {
    await supabase.auth.signOut()
  },

  // ── Musicians ─────────────────────────────────────────────────────────────
  musicians: [],

  fetchMusicians: async () => {
    const me = get().currentUser
    const [{ data, error }, blocksResult] = await Promise.all([
      supabase
        .from('profiles')
        .select(PUBLIC_PROFILE_COLUMNS)
        .order('created_at', { ascending: true }),
      // Re-read with profiles so blocks made on another device apply here too
      me
        ? supabase.from('blocks').select('blocked_id').eq('blocker_id', me.id)
        : Promise.resolve({ data: [] as { blocked_id: string }[], error: null }),
    ])

    if (!error) {
      const dbMusicians: Musician[] = (data ?? []).map((row: any) => ({
        id: row.id,
        displayName: row.display_name,
        bio: row.bio ?? '',
        instruments: row.instruments ?? [],
        genres: row.genres ?? [],
        // Hidden profiles are stored at 0,0 — treat them as having no location
        lat: row.location_precision === 'hidden' ? NaN : row.lat,
        lng: row.location_precision === 'hidden' ? NaN : row.lng,
        locationName: row.location_name ?? '',
        lookingFor: row.looking_for ?? '',
        avatarUrl: row.avatar_url ?? undefined,
        locationPrecision: (row.location_precision as Musician['locationPrecision']) ?? 'exact',
        neighborhood: row.neighborhood ?? '',
        level: row.level ?? undefined,
        createdAt: row.created_at,
        lastSeenAt: newerIso(
          row.last_seen_at ?? undefined,
          row.id === heartbeatUserId ? lastPingIso ?? undefined : undefined,
        ),
        primaryInstrument: row.primary_instrument ?? undefined,
        gear: Array.isArray(row.gear) ? row.gear : [],
        availability: row.availability as boolean[][] ?? undefined,
        yearsPlaying: row.years_playing ?? undefined,
        isTest: row.is_test ?? false,
        offersLessons: row.offers_lessons ?? false,
        websiteUrl: row.website_url ?? undefined,
        instagramUrl: row.instagram_url ?? undefined,
        youtubeUrl: row.youtube_url ?? undefined,
        soundcloudUrl: row.soundcloud_url ?? undefined,
        bandcampUrl: row.bandcamp_url ?? undefined,
        tiktokUrl: row.tiktok_url ?? undefined,
        audioUrl: row.audio_url ?? undefined,
      }))
      // Merge the signed-in user's OWN private contact details (RLS: owner-only row)
      if (me) {
        const { data: own } = await supabase
          .from('profile_contacts')
          .select('contact_email, phone')
          .eq('id', me.id)
          .maybeSingle()
        const mine = dbMusicians.find(m => m.id === me.id)
        if (mine) {
          mine.email = me.email
          mine.contactEmail = own?.contact_email ?? ''
          mine.phone = own?.phone ?? undefined
        }
      }
      // Keep the previous block list if that read failed, rather than unhiding everyone
      const blocked: Record<string, true> = blocksResult.error ? get().blocked : {}
      if (!blocksResult.error) blocksResult.data?.forEach(r => { blocked[r.blocked_id] = true })
      const blockedProfiles: AppStore['blockedProfiles'] = {}
      dbMusicians.forEach(m => {
        if (blocked[m.id]) blockedProfiles[m.id] = { displayName: m.displayName, avatarUrl: m.avatarUrl }
      })
      set({ musicians: dbMusicians.filter(m => !blocked[m.id]), blocked, blockedProfiles })
    }
  },

  saveProfile: async (profile) => {
    const user = get().currentUser
    if (!user) return { ok: false, error: 'Not signed in' }
    // profiles is public: a hidden profile must not publish where it is
    // (the profiles_strip_hidden_location trigger enforces this server-side too)
    const hidden = profile.locationPrecision === 'hidden'
    const { error } = await supabase.from('profiles').upsert({
      id: user.id,
      display_name: profile.displayName,
      bio: profile.bio,
      instruments: profile.instruments,
      genres: profile.genres,
      lat: hidden ? 0 : profile.lat,
      lng: hidden ? 0 : profile.lng,
      location_name: hidden ? '' : profile.locationName,
      looking_for: profile.lookingFor,
      location_precision: profile.locationPrecision ?? 'exact',
      neighborhood: hidden ? null : profile.neighborhood ?? null,
      level: profile.level ?? null,
      last_seen_at: new Date().toISOString(),
      primary_instrument: profile.primaryInstrument ?? null,
      gear: profile.gear ?? [],
      availability: profile.availability ?? null,
      years_playing: profile.yearsPlaying ?? null,
      avatar_url: profile.avatarUrl ?? null,
      offers_lessons: profile.offersLessons ?? false,
      website_url: profile.websiteUrl ?? null,
      instagram_url: profile.instagramUrl ?? null,
      youtube_url: profile.youtubeUrl ?? null,
      soundcloud_url: profile.soundcloudUrl ?? null,
      bandcamp_url: profile.bandcampUrl ?? null,
      tiktok_url: profile.tiktokUrl ?? null,
      discord_url: null, // Discord field was removed from profiles; clears old links on save
      audio_url: profile.audioUrl ?? null,
    })
    // Private contact details go to the owner-only table, never to public profiles
    const contactRow: Record<string, unknown> = {
      id: user.id,
      contact_email: profile.contactEmail ?? user.email,
      updated_at: new Date().toISOString(),
    }
    if (profile.phone !== undefined) contactRow.phone = profile.phone
    const { error: contactErr } = await supabase.from('profile_contacts').upsert(contactRow)
    if (error || contactErr) {
      const message = error?.message ?? contactErr?.message
      console.warn('Profile save failed:', message)
      return { ok: false, error: message }
    }
    await get().fetchMusicians()
    get().showToast('Profile saved')
    return { ok: true }
  },

  currentProfile: () => {
    const user = get().currentUser
    return user ? get().musicians.find(m => m.id === user.id) : undefined
  },

  removeProfile: async () => {
    const user = get().currentUser
    if (!user) return
    // RLS policy allows the owner to delete their own row
    await supabase.from('profiles').delete().eq('id', user.id)
    await supabase.from('profile_contacts').delete().eq('id', user.id)
    removeOwnFiles(user.id)
    await get().fetchMusicians()
  },

  deleteAccount: async () => {
    const user = get().currentUser
    if (!user) return false
    // Server endpoint uses service role key to delete the auth user (and their uploaded files).
    // The profiles row cascades automatically via ON DELETE CASCADE.
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/self-delete', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${session?.access_token}` },
    }).catch(() => null)
    if (!res?.ok) {
      get().showToast('Could not delete account — please try again')
      return false
    }
    await supabase.auth.signOut()
    return true
  },

  // ── Layout & search ───────────────────────────────────────────────────────
  selectedId: null,
  query: '',
  searchLoc: null,
  activeTab: 'map',
  filters: { ...DEFAULT_FILTERS },
  showFilterPanel: (() => { try { return !localStorage.getItem('mm-filter-panel-dismissed') } catch { return true } })(),

  setSelectedId: (id) => set({ selectedId: id }),
  setQuery: (q) => set({ query: q }),
  setSearchLoc: (loc) => set({ searchLoc: loc }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  setFilters: (partial) => set(s => ({ filters: { ...s.filters, ...partial } })),
  resetFilters: () => set({ filters: { ...DEFAULT_FILTERS } }),
  setShowFilterPanel: (show) => {
    try { if (!show) localStorage.setItem('mm-filter-panel-dismissed', '1') } catch { /* */ }
    set({ showFilterPanel: show })
  },

  filterCount: () => {
    const { filters } = get()
    let count = 0
    if (filters.instruments.length > 0) count++
    if (filters.genres.length > 0) count++
    if (filters.levels.length > 0) count++
    if (filters.lookingFor.length > 0) count++
    if (filters.distanceMi !== 25) count++
    if (filters.onlineOnly) count++
    return count
  },

  // Where distances are measured from: the searched place, else the user's own pin
  searchOrigin: () => {
    const { searchLoc } = get()
    if (searchLoc) return searchLoc
    const profile = get().currentProfile()
    if (profile && !isNaN(profile.lat) && !isNaN(profile.lng)) return { lat: profile.lat, lng: profile.lng }
    return null
  },

  filteredMusicians: () => {
    const { musicians, query, filters } = get()
    const origin = get().searchOrigin()
    const currentUserId = get().currentUser?.id
    let list = musicians.filter(m => m.locationPrecision !== 'hidden' || m.id === currentUserId)

    if (filters.instruments.length > 0) {
      list = list.filter(m => m.instruments.some(i => filters.instruments.includes(i)))
    }
    if (filters.genres.length > 0) {
      list = list.filter(m => m.genres.some(g => filters.genres.includes(g)))
    }
    if (filters.levels.length > 0) {
      list = list.filter(m => m.level && filters.levels.includes(m.level))
    }
    if (filters.lookingFor.length > 0) {
      list = list.filter(m => filters.lookingFor.some(lf => {
        // Teacher filtering for students: show profiles that want lessons/teaching
        if (lf === 'Students') return m.lookingFor.includes('Lessons')
        return m.lookingFor.includes(lf)
      }))
    }
    if (filters.distanceMi !== 0 && origin) {
      list = list.filter(m => {
        if (isNaN(m.lat) || isNaN(m.lng)) return true
        return haversineDistanceMiles(origin.lat, origin.lng, m.lat, m.lng) <= filters.distanceMi
      })
    }
    if (filters.onlineOnly) {
      list = list.filter(m => isOnline(m.lastSeenAt))
    }
    if (query.trim()) {
      const q = query.trim().toLowerCase()
      list = list.filter(m =>
        m.displayName.toLowerCase().includes(q) ||
        m.instruments.some(i => i.toLowerCase().includes(q)) ||
        m.genres.some(g => g.toLowerCase().includes(q)) ||
        m.locationName.toLowerCase().includes(q) ||
        (m.lookingFor && m.lookingFor.toLowerCase().includes(q)) ||
        (m.bio && m.bio.toLowerCase().includes(q))
      )
    }
    return list
  },

  // ── Saved ─────────────────────────────────────────────────────────────────
  saved: {},

  fetchSaved: async () => {
    const user = get().currentUser
    if (!user) return
    const { data } = await supabase
      .from('saved_musicians')
      .select('musician_id, note')
      .eq('user_id', user.id)
    if (data) {
      const saved: Record<string, string> = {}
      data.forEach(r => { saved[r.musician_id] = r.note ?? '' })
      set({ saved })
    }
  },

  toggleSaved: async (musicianId) => {
    const user = get().currentUser
    if (!user) return
    const { saved } = get()
    if (saved[musicianId] !== undefined) {
      await supabase.from('saved_musicians').delete().eq('user_id', user.id).eq('musician_id', musicianId)
      const next = { ...saved }
      delete next[musicianId]
      set({ saved: next })
    } else {
      await supabase.from('saved_musicians').insert({ user_id: user.id, musician_id: musicianId, note: '' })
      set({ saved: { ...saved, [musicianId]: '' } })
    }
  },

  updateNote: async (musicianId, note) => {
    const user = get().currentUser
    if (!user) return
    await supabase.from('saved_musicians').update({ note }).eq('user_id', user.id).eq('musician_id', musicianId)
    set(s => ({ saved: { ...s.saved, [musicianId]: note } }))
  },

  // ── Messages ──────────────────────────────────────────────────────────────
  threads: {},
  unread: {},
  activeThreadId: null,

  fetchThreads: async () => {
    const user = get().currentUser
    if (!user) return
    const { data } = await supabase
      .from('messages')
      .select('*')
      .or(`from_id.eq.${user.id},to_id.eq.${user.id}`)
      .order('created_at', { ascending: true })
    if (data) {
      const threads: Record<string, Message[]> = {}
      const unread: Record<string, boolean> = {}
      data.forEach(row => {
        const otherId = row.from_id === user.id ? row.to_id : row.from_id
        if (!threads[otherId]) threads[otherId] = []
        threads[otherId].push({
          id: row.id,
          fromId: row.from_id,
          toId: row.to_id,
          body: row.body,
          createdAt: row.created_at,
          readAt: row.read_at ?? undefined,
        })
        if (row.to_id === user.id && !row.read_at) unread[otherId] = true
      })
      set({ threads, unread })
    }
  },

  sendMessage: async (toId, body) => {
    const user = get().currentUser
    if (!user) return
    const { data, error } = await supabase
      .from('messages')
      .insert({ from_id: user.id, to_id: toId, body })
      .select()
      .single()
    if (error) { get().showToast('Failed to send message'); return }
    if (data) {
      const msg: Message = {
        id: data.id,
        fromId: data.from_id,
        toId: data.to_id,
        body: data.body,
        createdAt: data.created_at,
      }
      set(s => ({ threads: { ...s.threads, [toId]: [...(s.threads[toId] ?? []), msg] } }))
    }
  },

  markThreadRead: async (userId) => {
    const user = get().currentUser
    if (!user) return
    await supabase
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('from_id', userId)
      .eq('to_id', user.id)
      .is('read_at', null)
    set(s => { const u = { ...s.unread }; delete u[userId]; return { unread: u } })
  },

  setActiveThreadId: (id) => set({ activeThreadId: id }),

  // ── Contact requests ──────────────────────────────────────────────────────
  contactRequests: { outgoing: {}, incoming: {} },
  revealedContacts: {},

  fetchContactRequests: async () => {
    const user = get().currentUser
    if (!user) return
    const { data } = await supabase
      .from('contact_requests')
      .select('*')
      .or(`from_id.eq.${user.id},to_id.eq.${user.id}`)
    if (data) {
      const outgoing: Record<string, ContactRequestStatus> = {}
      const incoming: Record<string, 'pending'> = {}
      const acceptedIds: string[] = []
      data.forEach(row => {
        if (row.from_id === user.id) {
          outgoing[row.to_id] = row.status as ContactRequestStatus
          if (row.status === 'accepted') acceptedIds.push(row.to_id)
        } else {
          if (row.status === 'pending') incoming[row.from_id] = 'pending'
          if (row.status === 'accepted') acceptedIds.push(row.from_id)
        }
      })
      // Contact details are only readable for accepted requests (enforced by RLS on profile_contacts)
      const revealedContacts: Record<string, { email: string; phone?: string }> = {}
      if (acceptedIds.length > 0) {
        const { data: contacts } = await supabase
          .from('profile_contacts')
          .select('id, contact_email, phone')
          .in('id', acceptedIds)
        contacts?.forEach(c => {
          if (c.contact_email) revealedContacts[c.id] = { email: c.contact_email, phone: c.phone ?? undefined }
        })
      }
      set({ contactRequests: { outgoing, incoming }, revealedContacts })
    }
  },

  requestContact: async (musicianId) => {
    const user = get().currentUser
    if (!user) return
    await supabase.from('contact_requests').insert({ from_id: user.id, to_id: musicianId })
    set(s => ({
      contactRequests: {
        ...s.contactRequests,
        outgoing: { ...s.contactRequests.outgoing, [musicianId]: 'pending' },
      },
    }))
  },

  respondToContactRequest: async (fromId, accept) => {
    const user = get().currentUser
    if (!user) return
    const status = accept ? 'accepted' : 'declined'
    await supabase
      .from('contact_requests')
      .update({ status })
      .eq('from_id', fromId)
      .eq('to_id', user.id)
    let revealed: { email: string; phone?: string } | null = null
    if (accept) {
      // Readable now that the request is accepted (RLS on profile_contacts)
      const { data: c } = await supabase
        .from('profile_contacts')
        .select('contact_email, phone')
        .eq('id', fromId)
        .maybeSingle()
      if (c?.contact_email) revealed = { email: c.contact_email, phone: c.phone ?? undefined }
    }
    set(s => {
      const incoming = { ...s.contactRequests.incoming }
      delete incoming[fromId]
      const revealedContacts = { ...s.revealedContacts }
      if (revealed) revealedContacts[fromId] = revealed
      return { contactRequests: { ...s.contactRequests, incoming }, revealedContacts }
    })
  },

  initMessages: async () => {
    await Promise.all([
      get().fetchSaved(),
      get().fetchThreads(),
      get().fetchContactRequests(),
    ])
    const user = get().currentUser
    if (!user) return
    if (realtimeChannel) await supabase.removeChannel(realtimeChannel)
    realtimeChannel = supabase
      .channel(`inbox-realtime-${Date.now()}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `to_id=eq.${user.id}` },
        (payload) => {
          const row = payload.new as { id: string; from_id: string; to_id: string; body: string; created_at: string }
          const msg: Message = { id: row.id, fromId: row.from_id, toId: row.to_id, body: row.body, createdAt: row.created_at }
          const otherId = row.from_id
          if (get().blocked[otherId]) return
          // activeThreadId survives leaving the Messages tab, so check the tab too
          const isViewing = get().activeTab === 'messages' && get().activeThreadId === otherId
          if (isViewing) {
            supabase.from('messages').update({ read_at: new Date().toISOString() }).eq('id', row.id).then()
          }
          set(s => ({
            threads: { ...s.threads, [otherId]: [...(s.threads[otherId] ?? []), msg] },
            unread: isViewing ? s.unread : { ...s.unread, [otherId]: true },
          }))
          if (!isViewing) {
            const musician = get().musicians.find(m => m.id === otherId)
            get().showToast(musician ? `New message from ${musician.displayName.split(' ')[0]}` : 'New message')
          }
        }
      )
      .subscribe()
  },

  unreadCount: () => {
    const { unread, contactRequests, blocked } = get()
    return Object.keys(unread).filter(id => !blocked[id]).length
      + Object.keys(contactRequests.incoming).filter(id => !blocked[id]).length
  },

  // ── Blocking ──────────────────────────────────────────────────────────────
  blocked: {},
  blockedProfiles: {},

  blockUser: async (userId) => {
    const user = get().currentUser
    if (!user || userId === user.id) return false
    const { error } = await supabase.from('blocks').insert({ blocker_id: user.id, blocked_id: userId })
    // 23505 = already blocked (e.g. from another device)
    if (error && error.code !== '23505') { get().showToast('Could not block — please try again'); return false }
    set(s => {
      const musician = s.musicians.find(m => m.id === userId)
      const revealedContacts = { ...s.revealedContacts }
      delete revealedContacts[userId]
      return {
        blocked: { ...s.blocked, [userId]: true },
        blockedProfiles: musician
          ? { ...s.blockedProfiles, [userId]: { displayName: musician.displayName, avatarUrl: musician.avatarUrl } }
          : s.blockedProfiles,
        musicians: s.musicians.filter(m => m.id !== userId),
        revealedContacts,
        selectedId: s.selectedId === userId ? null : s.selectedId,
        activeThreadId: s.activeThreadId === userId ? null : s.activeThreadId,
      }
    })
    get().showToast('Blocked')
    return true
  },

  unblockUser: async (userId) => {
    const user = get().currentUser
    if (!user) return
    const { error } = await supabase.from('blocks').delete().eq('blocker_id', user.id).eq('blocked_id', userId)
    if (error) { get().showToast('Could not unblock — please try again'); return }
    // Refetch so their profile and any shared contact details come back
    await Promise.all([get().fetchMusicians(), get().fetchContactRequests()])
    get().showToast('Unblocked')
  },

  // ── Toast ─────────────────────────────────────────────────────────────────
  toast: null,
  showToast: (msg) => {
    set({ toast: msg })
    setTimeout(() => set({ toast: null }), 2500)
  },
}))
