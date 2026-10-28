export type Level = 'Beginner' | 'Intermediate' | 'Advanced' | 'Pro'

export interface Musician {
  id: string           // same as user.id
  // Private: only populated for the signed-in user's own profile (and in the admin panel).
  // Never read from the public profiles table.
  email?: string
  displayName: string
  bio: string
  instruments: string[]
  genres: string[]
  contactEmail?: string
  lat: number
  lng: number
  locationName: string
  avatarUrl?: string
  lookingFor: string   // comma-separated, e.g. "Band Members, Session Work"
  level?: Level
  locationPrecision?: 'exact' | 'area' | 'hidden'
  neighborhood?: string
  createdAt: string
  lastSeenAt?: string
  primaryInstrument?: string
  gear?: string[]
  availability?: boolean[][]
  phone?: string
  yearsPlaying?: number
  isTest?: boolean
  offersLessons?: boolean
  websiteUrl?: string
  instagramUrl?: string
  youtubeUrl?: string
  soundcloudUrl?: string
  bandcampUrl?: string
  tiktokUrl?: string
  discordUrl?: string
  audioUrl?: string
}

export type ActiveModal = 'auth' | 'profile' | 'musician-detail' | 'reset-password' | null

export interface Message {
  id: string
  fromId: string
  toId: string
  body: string
  createdAt: string
  readAt?: string
}

export type ContactRequestStatus = 'pending' | 'accepted' | 'declined'

export const INSTRUMENT_OPTIONS = [
  'Guitar', 'Bass', 'Drums', 'Keyboard / Piano', 'Vocals', 'Violin',
  'Trumpet', 'Saxophone', 'Cello', 'Flute', 'Banjo', 'Ukulele',
  'Mandolin', 'Harmonica', 'Synthesizer', 'DJ / Producer', 'Other',
]

export const GENRE_OPTIONS = [
  'Rock', 'Jazz', 'Blues', 'Folk / Acoustic', 'Classical', 'Hip-Hop / Rap',
  'R&B / Soul', 'Country', 'Electronic / EDM', 'Pop', 'Metal', 'Punk',
  'Reggae', 'Funk', 'Gospel', 'Latin', 'Alternative', 'Indie', 'Other',
]

export const LOOKING_FOR_OPTIONS = [
  'Band Members', 'Jam Partner', 'Session Work', 'Lessons',
  'Recording Collaborator', 'Live Gigs', 'Students', 'Just Meeting Other Musicians',
]

export const DISTANCE_OPTIONS = [1, 5, 10, 25, 50, 100, 0] as const
export const distanceLabel = (d: number) => d === 0 ? 'Worldwide' : `${d} mi`
