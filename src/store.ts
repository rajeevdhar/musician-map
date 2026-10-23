import { create } from 'zustand'
import { supabase } from './lib/supabase'
import type { Musician, ActiveModal, Level, Message, ContactRequestStatus } from './types'
import { haversineDistanceMiles } from './lib/musicianUtils'

export interface Filters {
  instruments: string[]
  genres: string[]
  level: 'Any' | Level
  lookingFor: string[]
  distanceMi: 1 | 5 | 10 | 25 | 50 | 100 | 0
}

const DEFAULT_FILTERS: Filters = {
  instruments: [],
  genres: [],
  level: 'Any',
  lookingFor: [],
  distanceMi: 25,
}

// ── Realtime channel ───────────────────────────────────────────────────────
let realtimeChannel: ReturnType<typeof supabase.channel> | null = null

// ── Presence heartbeat ─────────────────────────────────────────────────────
// Writes profiles.last_seen_at every 60s while signed in, and mirrors the
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
  heartbeatTimer = setInterval(ping, 300_000)
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

interface AppStore {
  // ── Auth ──────────────────────────────────────────────────────────────────
  currentUser: AppUser | null
  isAuthReady: boolean
  needsPasswordReset: boolean
  initAuth: () => void
  register: (email: string, password: string, displayName: string) => Promise<{ ok: boolean; error?: string }>
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>
  logout: () => Promise<void>

  // ── Musician profiles ─────────────────────────────────────────────────────
  musicians: Musician[]
  isLoadingMusicians: boolean
  fetchMusicians: () => Promise<void>
  saveProfile: (profile: Omit<Musician, 'id' | 'email' | 'createdAt'>) => Promise<void>
  currentProfile: () => Musician | undefined
  removeProfile: () => Promise<void>
  deleteAccount: () => Promise<void>

  // ── UI ────────────────────────────────────────────────────────────────────
  activeModal: ActiveModal
  selectedMusician: Musician | null
  openModal: (modal: ActiveModal, payload?: Musician) => void
  closeModal: () => void

  // ── Layout & search ───────────────────────────────────────────────────────
  selectedId: string | null
  query: string
  activeTab: 'map' | 'list' | 'saved' | 'messages' | 'me'
  filters: Filters
  showFilterPanel: boolean
  setSelectedId: (id: string | null) => void
  setQuery: (q: string) => void
  setActiveTab: (tab: AppStore['activeTab']) => void
  setFilters: (partial: Partial<Filters>) => void
  resetFilters: () => void
  setShowFilterPanel: (show: boolean) => void
  filterCount: () => number
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
          currentUser: {
            id: u.id,
            email: u.email!,
            displayName: u.user_metadata?.displayName ?? u.email!,
          },
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
          currentUser: {
            id: u.id,
            email: u.email!,
            displayName: u.user_metadata?.displayName ?? u.email!,
          },
        })
        startHeartbeat(u.id).finally(() => get().fetchMusicians())
      } else if ((event === 'SIGNED_IN' || event === 'USER_UPDATED') && session?.user) {
        const u = session.user
        set({
          currentUser: {
            id: u.id,
            email: u.email!,
            displayName: u.user_metadata?.displayName ?? u.email!,
          },
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
          saved: {},
          threads: {},
          unread: {},
          activeThreadId: null,
          contactRequests: { outgoing: {}, incoming: {} },
          revealedContacts: {},
        })
        get().fetchMusicians()
      }
    })
  },

  register: async (email, password, displayName) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { displayName } },
    })
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  },

  login: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  },

  logout: async () => {
    await supabase.auth.signOut()
  },

  // ── Musicians ─────────────────────────────────────────────────────────────
  musicians: [],
  isLoadingMusicians: false,

  fetchMusicians: async () => {
    set({ isLoadingMusicians: true })
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: true })

    if (!error) {
      const dbMusicians: Musician[] = (data ?? []).map(row => ({
        id: row.id,
        email: row.email,
        displayName: row.display_name,
        bio: row.bio ?? '',
        instruments: row.instruments ?? [],
        genres: row.genres ?? [],
        contactEmail: row.contact_email ?? '',
        lat: row.lat,
        lng: row.lng,
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
        phone: row.phone ?? undefined,
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
      set({ musicians: dbMusicians })
    }
    set({ isLoadingMusicians: false })
  },

  saveProfile: async (profile) => {
    const user = get().currentUser
    if (!user) return
    const { error } = await supabase.from('profiles').upsert({
      id: user.id,
      email: user.email,
      display_name: profile.displayName,
      bio: profile.bio,
      instruments: profile.instruments,
      genres: profile.genres,
      contact_email: profile.contactEmail,
      lat: profile.lat,
      lng: profile.lng,
      location_name: profile.locationName,
      looking_for: profile.lookingFor,
      location_precision: profile.locationPrecision ?? 'exact',
      neighborhood: profile.neighborhood ?? null,
      level: profile.level ?? null,
      last_seen_at: new Date().toISOString(),
      primary_instrument: profile.primaryInstrument ?? null,
      gear: profile.gear ?? [],
      availability: profile.availability ?? null,
      phone: profile.phone ?? null,
      years_playing: profile.yearsPlaying ?? null,
      avatar_url: profile.avatarUrl ?? null,
      offers_lessons: profile.offersLessons ?? false,
      website_url: profile.websiteUrl ?? null,
      instagram_url: profile.instagramUrl ?? null,
      youtube_url: profile.youtubeUrl ?? null,
      soundcloud_url: profile.soundcloudUrl ?? null,
      bandcamp_url: profile.bandcampUrl ?? null,
      tiktok_url: profile.tiktokUrl ?? null,
      audio_url: profile.audioUrl ?? null,
    })
    if (!error) {
      await get().fetchMusicians()
      get().showToast('Profile saved')
    }
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
    await get().fetchMusicians()
  },

  deleteAccount: async () => {
    const user = get().currentUser
    if (!user) return
    // Server endpoint uses service role key to delete the auth user.
    // The profiles row cascades automatically via ON DELETE CASCADE.
    const { data: { session } } = await supabase.auth.getSession()
    await fetch('/api/self-delete', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${session?.access_token}` },
    })
    await supabase.auth.signOut()
  },

  // ── UI ────────────────────────────────────────────────────────────────────
  activeModal: null,
  selectedMusician: null,

  openModal: (modal, payload) => {
    if (modal === 'musician-detail') set({ activeModal: modal, selectedMusician: payload as Musician })
    else set({ activeModal: modal })
  },

  closeModal: () => set({ activeModal: null, selectedMusician: null }),

  // ── Layout & search ───────────────────────────────────────────────────────
  selectedId: null,
  query: '',
  activeTab: 'map',
  filters: { ...DEFAULT_FILTERS },
  showFilterPanel: !localStorage.getItem('mm-filter-panel-dismissed'),

  setSelectedId: (id) => set({ selectedId: id }),
  setQuery: (q) => set({ query: q }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  setFilters: (partial) => set(s => ({ filters: { ...s.filters, ...partial } })),
  resetFilters: () => set({ filters: { ...DEFAULT_FILTERS } }),
  setShowFilterPanel: (show) => {
    if (!show) localStorage.setItem('mm-filter-panel-dismissed', '1')
    set({ showFilterPanel: show })
  },

  filterCount: () => {
    const { filters } = get()
    let count = 0
    if (filters.instruments.length > 0) count++
    if (filters.genres.length > 0) count++
    if (filters.level !== 'Any') count++
    if (filters.lookingFor.length > 0) count++
    if (filters.distanceMi !== 25) count++
    return count
  },

  filteredMusicians: () => {
    const { musicians, query, filters } = get()
    const profile = get().currentProfile()
    const userLat = profile?.lat
    const userLng = profile?.lng
    const currentUserId = get().currentUser?.id
    let list = musicians.filter(m => m.locationPrecision !== 'hidden' || m.id === currentUserId)

    if (filters.instruments.length > 0) {
      list = list.filter(m => m.instruments.some(i => filters.instruments.includes(i)))
    }
    if (filters.genres.length > 0) {
      list = list.filter(m => m.genres.some(g => filters.genres.includes(g)))
    }
    if (filters.level !== 'Any') {
      list = list.filter(m => m.level === filters.level)
    }
    if (filters.lookingFor.length > 0) {
      list = list.filter(m => filters.lookingFor.some(lf => {
        // Teacher filtering for students: show profiles that want lessons/teaching
        if (lf === 'Students') return m.lookingFor.includes('Lessons')
        return m.lookingFor.includes(lf)
      }))
    }
    if (filters.distanceMi !== 0 && userLat != null && userLng != null && !isNaN(userLat) && !isNaN(userLng)) {
      list = list.filter(m => {
        if (isNaN(m.lat) || isNaN(m.lng)) return true
        return haversineDistanceMiles(userLat, userLng, m.lat, m.lng) <= filters.distanceMi
      })
    }
    if (query.trim()) {
      const q = query.toLowerCase()
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
    const { data } = await supabase
      .from('messages')
      .insert({ from_id: user.id, to_id: toId, body })
      .select()
      .single()
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
      const revealedContacts: Record<string, { email: string }> = {}
      data.forEach(row => {
        if (row.from_id === user.id) {
          outgoing[row.to_id] = row.status as ContactRequestStatus
          if (row.status === 'accepted') {
            const m = get().musicians.find(x => x.id === row.to_id)
            if (m?.contactEmail) revealedContacts[row.to_id] = { email: m.contactEmail }
          }
        } else {
          if (row.status === 'pending') incoming[row.from_id] = 'pending'
          if (row.status === 'accepted') {
            const m = get().musicians.find(x => x.id === row.from_id)
            if (m?.contactEmail) revealedContacts[row.from_id] = { email: m.contactEmail }
          }
        }
      })
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
    set(s => {
      const incoming = { ...s.contactRequests.incoming }
      delete incoming[fromId]
      const revealedContacts = { ...s.revealedContacts }
      if (accept) {
        const m = get().musicians.find(x => x.id === fromId)
        if (m?.contactEmail) revealedContacts[fromId] = { email: m.contactEmail }
      }
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
    if (realtimeChannel) supabase.removeChannel(realtimeChannel)
    realtimeChannel = supabase
      .channel('inbox-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `to_id=eq.${user.id}` },
        (payload) => {
          const row = payload.new as { id: string; from_id: string; to_id: string; body: string; created_at: string }
          const msg: Message = { id: row.id, fromId: row.from_id, toId: row.to_id, body: row.body, createdAt: row.created_at }
          const otherId = row.from_id
          const isViewing = get().activeThreadId === otherId
          set(s => ({
            threads: { ...s.threads, [otherId]: [...(s.threads[otherId] ?? []), msg] },
            unread: isViewing ? s.unread : { ...s.unread, [otherId]: true },
          }))
          if (!isViewing) {
            const musician = get().musicians.find(m => m.id === otherId)
            if (musician) get().showToast(`New message from ${musician.displayName.split(' ')[0]}`)
          }
        }
      )
      .subscribe()
  },

  unreadCount: () => {
    const { unread, contactRequests } = get()
    return Object.keys(unread).length + Object.keys(contactRequests.incoming).length
  },

  // ── Toast ─────────────────────────────────────────────────────────────────
  toast: null,
  showToast: (msg) => {
    set({ toast: msg })
    setTimeout(() => set({ toast: null }), 2500)
  },
}))
