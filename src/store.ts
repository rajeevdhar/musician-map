import { create } from 'zustand'
import { supabase } from './lib/supabase'
import type { Musician, CraigslistPost, ActiveModal } from './types'

// Seed musicians rendered client-side — not stored in the DB.
// Real registered users go into Supabase's `profiles` table.
const SEED_MUSICIANS: Musician[] = [
  {
    id: 'seed-1',
    email: 'maya.chen@example.com',
    displayName: 'Maya Chen',
    bio: 'Jazz pianist and composer. Gigging around the Bay Area for 8 years. Influenced by Thelonious Monk and Brad Mehldau.',
    instruments: ['Keyboard / Piano'],
    genres: ['Jazz', 'Blues'],
    contactEmail: 'maya.chen@example.com',
    lat: 37.7749,
    lng: -122.4194,
    locationName: 'San Francisco, CA',
    lookingFor: 'Band Members, Recording Collaborator',
    createdAt: '2026-09-01T00:00:00Z',
  },
  {
    id: 'seed-2',
    email: 'darius.knight@example.com',
    displayName: 'Darius Knight',
    bio: 'Blues guitarist and vocalist. 15 years on the Chicago circuit. Own a PA and a van — ready to gig anywhere.',
    instruments: ['Guitar', 'Vocals'],
    genres: ['Blues', 'Rock', 'R&B / Soul'],
    contactEmail: 'darius.knight@example.com',
    lat: 41.8781,
    lng: -87.6298,
    locationName: 'Chicago, IL',
    lookingFor: 'Band Members, Live Gigs',
    createdAt: '2026-09-05T00:00:00Z',
  },
  {
    id: 'seed-3',
    email: 'sarah.flores@example.com',
    displayName: 'Sarah Flores',
    bio: 'Country/Americana vocalist and acoustic guitarist. Songwriter with two indie albums out. Looking for a solid rhythm section.',
    instruments: ['Vocals', 'Guitar'],
    genres: ['Country', 'Folk / Acoustic'],
    contactEmail: 'sarah.flores@example.com',
    lat: 36.1627,
    lng: -86.7816,
    locationName: 'Nashville, TN',
    lookingFor: 'Band Members, Live Gigs',
    createdAt: '2026-09-10T00:00:00Z',
  },
  {
    id: 'seed-4',
    email: 'tom.okafor@example.com',
    displayName: 'Tom Okafor',
    bio: 'Session drummer with studio experience. Comfortable in any genre but love playing funk and hip-hop. Available for hire.',
    instruments: ['Drums'],
    genres: ['Funk', 'Hip-Hop / Rap', 'R&B / Soul', 'Jazz'],
    contactEmail: 'tom.okafor@example.com',
    lat: 34.0522,
    lng: -118.2437,
    locationName: 'Los Angeles, CA',
    lookingFor: 'Session Work, Band Members',
    createdAt: '2026-09-12T00:00:00Z',
  },
  {
    id: 'seed-5',
    email: 'elena.vasquez@example.com',
    displayName: 'Elena Vasquez',
    bio: 'Classically trained violinist crossing into indie and folk. Looking for collaborative projects that blend acoustic and electric textures.',
    instruments: ['Violin'],
    genres: ['Classical', 'Indie', 'Folk / Acoustic'],
    contactEmail: 'elena.vasquez@example.com',
    lat: 47.6062,
    lng: -122.3321,
    locationName: 'Seattle, WA',
    lookingFor: 'Band Members, Recording Collaborator',
    createdAt: '2026-09-15T00:00:00Z',
  },
  {
    id: 'seed-6',
    email: 'jake.morrison@example.com',
    displayName: 'Jake Morrison',
    bio: 'Bass player and music producer. Deep in the Austin scene for 6 years. Into everything from Afrobeat to metal — versatile and reliable.',
    instruments: ['Bass', 'DJ / Producer'],
    genres: ['Rock', 'Electronic / EDM', 'Funk', 'Alternative'],
    contactEmail: 'jake.morrison@example.com',
    lat: 30.2672,
    lng: -97.7431,
    locationName: 'Austin, TX',
    lookingFor: 'Band Members, Jam Partner, Recording Collaborator',
    createdAt: '2026-09-18T00:00:00Z',
  },
  {
    id: 'seed-7',
    email: 'priya.nair@example.com',
    displayName: 'Priya Nair',
    bio: 'Saxophonist with a love for jazz fusion and Latin music. Originally from Miami, now gigging locally and doing studio sessions.',
    instruments: ['Saxophone'],
    genres: ['Jazz', 'Latin', 'R&B / Soul'],
    contactEmail: 'priya.nair@example.com',
    lat: 25.7617,
    lng: -80.1918,
    locationName: 'Miami, FL',
    lookingFor: 'Band Members, Session Work, Jam Partner',
    createdAt: '2026-09-20T00:00:00Z',
  },
  {
    id: 'seed-8',
    email: 'ben.walsh@example.com',
    displayName: 'Ben Walsh',
    bio: 'Singer-songwriter and acoustic guitarist. Performing original folk-rock in the Denver area. Looking for a co-writer or a full band.',
    instruments: ['Guitar', 'Vocals', 'Harmonica'],
    genres: ['Folk / Acoustic', 'Rock', 'Alternative'],
    contactEmail: 'ben.walsh@example.com',
    lat: 39.7392,
    lng: -104.9903,
    locationName: 'Denver, CO',
    lookingFor: 'Band Members, Recording Collaborator, Just Meeting Other Musicians',
    createdAt: '2026-09-22T00:00:00Z',
  },
]

export interface AppUser {
  id: string
  email: string
  displayName: string
}

interface AppStore {
  // ── Auth ──────────────────────────────────────────────────────────────────
  currentUser: AppUser | null
  isAuthReady: boolean
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

  // ── Craigslist ────────────────────────────────────────────────────────────
  craigslistPosts: CraigslistPost[]
  selectedCityId: string
  isLoadingCL: boolean
  clError: string | null
  fetchCraigslist: (cityId: string) => Promise<void>

  // ── UI ────────────────────────────────────────────────────────────────────
  activeModal: ActiveModal
  selectedMusician: Musician | null
  selectedPost: CraigslistPost | null
  openModal: (modal: ActiveModal, payload?: Musician | CraigslistPost) => void
  closeModal: () => void
}

export const useStore = create<AppStore>()((set, get) => ({
  // ── Auth ─────────────────────────────────────────────────────────────────
  currentUser: null,
  isAuthReady: false,

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
      } else {
        set({ isAuthReady: true })
      }
      get().fetchMusicians()
    })

    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        const u = session.user
        set({
          currentUser: {
            id: u.id,
            email: u.email!,
            displayName: u.user_metadata?.displayName ?? u.email!,
          },
        })
        get().fetchMusicians()
      } else if (event === 'SIGNED_OUT') {
        set({ currentUser: null })
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
  musicians: SEED_MUSICIANS,
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
        createdAt: row.created_at,
      }))
      // Seed ids never collide with UUID-based DB ids, but guard anyway
      const dbIds = new Set(dbMusicians.map(m => m.id))
      const visibleSeeds = SEED_MUSICIANS.filter(s => !dbIds.has(s.id))
      set({ musicians: [...visibleSeeds, ...dbMusicians] })
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
    })
    if (!error) await get().fetchMusicians()
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

  // ── Craigslist ────────────────────────────────────────────────────────────
  craigslistPosts: [],
  selectedCityId: 'newyork',
  isLoadingCL: false,
  clError: null,

  fetchCraigslist: async (cityId) => {
    set({ isLoadingCL: true, clError: null, selectedCityId: cityId })
    try {
      const res = await fetch(`/api/craigslist?city=${cityId}`)
      const data = await res.json()
      set({
        craigslistPosts: data.posts ?? [],
        clError: data.error ?? null,
        isLoadingCL: false,
      })
    } catch {
      set({ isLoadingCL: false, clError: 'API server not running — start with: npm run dev' })
    }
  },

  // ── UI ────────────────────────────────────────────────────────────────────
  activeModal: null,
  selectedMusician: null,
  selectedPost: null,

  openModal: (modal, payload) => {
    if (modal === 'musician-detail') set({ activeModal: modal, selectedMusician: payload as Musician })
    else if (modal === 'craigslist-detail') set({ activeModal: modal, selectedPost: payload as CraigslistPost })
    else set({ activeModal: modal })
  },

  closeModal: () => set({ activeModal: null, selectedMusician: null, selectedPost: null }),
}))
