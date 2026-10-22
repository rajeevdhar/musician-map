export type Level = 'Beginner' | 'Intermediate' | 'Advanced' | 'Pro'

export interface Musician {
  id: string           // same as user.id
  email: string
  displayName: string
  bio: string
  instruments: string[]
  genres: string[]
  contactEmail: string
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
  'Band Members', 'Jam Partner', 'Session Work', 'Lessons / Teaching',
  'Recording Collaborator', 'Live Gigs', 'Just Meeting Other Musicians',
]
