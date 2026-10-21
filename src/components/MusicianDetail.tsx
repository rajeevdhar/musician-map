import type { Musician } from '../types'
import { useStore } from '../store'
import { MapPin, Mail, Pencil } from 'lucide-react'

interface Props {
  musician: Musician
  onClose: () => void
  onEditProfile?: () => void
}

function isOnline(lastSeenAt?: string): boolean {
  if (!lastSeenAt) return false
  return Date.now() - new Date(lastSeenAt).getTime() < 5 * 60 * 1000
}

function lastSeenLabel(lastSeenAt?: string): string | null {
  if (!lastSeenAt) return null
  const diff = Date.now() - new Date(lastSeenAt).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 2) return 'Online now'
  if (mins < 60) return `Active ${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `Active ${hrs}h ago`
  return null
}

export default function MusicianDetail({ musician, onClose, onEditProfile }: Props) {
  const { currentUser } = useStore()
  const isOwnProfile = currentUser?.id === musician.id
  const online = isOnline(musician.lastSeenAt)
  const seenLabel = lastSeenLabel(musician.lastSeenAt)

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-box max-w-sm">
        {/* Accent header */}
        <div className="h-16 bg-accent relative flex items-center px-5">
          <button onClick={onClose} className="absolute top-3 right-3 text-white/80 hover:text-white text-2xl leading-none">×</button>
          <div className="w-12 h-12 bg-ink flex items-center justify-center absolute -bottom-6 left-5 border-2 border-ground">
            <span className="text-white text-xs font-extrabold">
              {musician.instruments[0]?.slice(0, 2).toUpperCase() ?? 'MU'}
            </span>
          </div>
        </div>

        <div className="pt-9 px-5 pb-5 space-y-4">
          {/* Name & location */}
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-extrabold text-ink">{musician.displayName}</h2>
              {online && (
                <span className="flex items-center gap-1 text-xs text-accent-700 font-extrabold uppercase tracking-widest">
                  <span className="w-2 h-2 bg-accent inline-block" />
                  Online
                </span>
              )}
            </div>
            <p className="text-sm text-neutral-700 flex items-center gap-1 mt-0.5">
              <MapPin size={12} /> {musician.locationName}
            </p>
            {!online && seenLabel && (
              <p className="text-xs text-neutral-500 mt-0.5">{seenLabel}</p>
            )}
          </div>

          {/* Instruments */}
          {musician.instruments.length > 0 && (
            <div>
              <p className="text-[11px] font-extrabold text-neutral-700 uppercase tracking-widest mb-1.5">Instruments</p>
              <div className="flex flex-wrap gap-1.5">
                {musician.instruments.map(i => (
                  <span key={i} className="tag">{i}</span>
                ))}
              </div>
            </div>
          )}

          {/* Genres */}
          {musician.genres.length > 0 && (
            <div>
              <p className="text-[11px] font-extrabold text-neutral-700 uppercase tracking-widest mb-1.5">Genres</p>
              <div className="flex flex-wrap gap-1.5">
                {musician.genres.map(g => (
                  <span key={g} className="tag">{g}</span>
                ))}
              </div>
            </div>
          )}

          {/* Looking for */}
          {musician.lookingFor && (
            <div>
              <p className="text-[11px] font-extrabold text-neutral-700 uppercase tracking-widest mb-1.5">Looking for</p>
              <div className="flex flex-wrap gap-1.5">
                {musician.lookingFor.split(',').map(s => s.trim()).filter(Boolean).map(l => (
                  <span key={l} className="tag">{l}</span>
                ))}
              </div>
            </div>
          )}

          {/* Bio */}
          {musician.bio && (
            <p className="text-sm text-neutral-700 leading-relaxed">{musician.bio}</p>
          )}

          {/* Contact */}
          {!isOwnProfile && musician.contactEmail && (
            <a
              href={`mailto:${musician.contactEmail}?subject=Hey from MusicianMapper!`}
              className="flex items-center justify-between w-full h-[52px] bg-accent hover:bg-accent-600 text-white font-bold px-4 text-sm transition-colors"
            >
              <span className="flex items-center gap-2"><Mail size={14} /> Contact {musician.displayName.split(' ')[0]}</span>
              <span>→</span>
            </a>
          )}

          {isOwnProfile && onEditProfile && (
            <button
              onClick={() => { onClose(); onEditProfile() }}
              className="flex items-center justify-between w-full h-[52px] border-2 border-ink hover:bg-accent-100 text-ink font-bold px-4 text-sm transition-colors"
            >
              <span className="flex items-center gap-2"><Pencil size={14} /> Edit My Profile</span>
              <span>→</span>
            </button>
          )}

          {!currentUser && (
            <p className="text-xs text-center text-neutral-500">
              Sign in to contact this musician
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
