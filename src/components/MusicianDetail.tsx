import type { Musician } from '../types'
import { useStore } from '../store'
import { ArrowLeft, X, Heart, MapPin, Mail, Pencil, MessageSquare } from 'lucide-react'
import { getInstrumentCode } from '../lib/musicianUtils'
import { isOnline } from '../lib/presence'

interface Props {
  musician: Musician
  onClose: () => void
  isMobile?: boolean
  onEditProfile?: () => void
}

export default function MusicianDetail({ musician, onClose, isMobile = false, onEditProfile }: Props) {
  const { currentUser } = useStore()
  const isOwnProfile = currentUser?.id === musician.id
  const code = getInstrumentCode(musician.instruments)
  const online = isOnline(musician.lastSeenAt)

  return (
    <div className="flex flex-col h-full">
      {/* Photo area */}
      <div className="h-[200px] bg-neutral-300 relative flex-shrink-0 overflow-hidden">
        {musician.avatarUrl ? (
          <img src={musician.avatarUrl} alt={musician.displayName} className="w-full h-full object-cover grayscale" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-neutral-200">
            <span className="text-[48px] font-extrabold text-neutral-400">{code}</span>
          </div>
        )}
        {/* Close / back */}
        <button
          onClick={onClose}
          className="absolute top-3 left-3 w-10 h-10 bg-ground border-2 border-ink flex items-center justify-center hover:bg-accent-100 transition-colors"
        >
          {isMobile ? <ArrowLeft size={18} /> : <X size={18} />}
        </button>
        {/* Save (heart) */}
        <button className="absolute top-3 right-3 w-10 h-10 bg-ground border-2 border-ink flex items-center justify-center hover:bg-accent-100 transition-colors">
          <Heart size={18} />
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {/* Accent header block */}
        <div className="bg-accent border-t-2 border-ink px-4 pt-3.5 pb-4">
          <p className="text-[11px] font-extrabold uppercase tracking-widest text-white/70 mb-1">
            {code} · {musician.instruments[0] ?? 'Musician'}
            {online && ' · Online now'}
          </p>
          <h2 className="text-[40px] font-extrabold text-white leading-none tracking-tight">{musician.displayName}</h2>
          <p className="text-[14px] font-semibold text-white/80 mt-1.5 flex items-center gap-1">
            <MapPin size={12} />
            {musician.locationName}
          </p>
        </div>

        {/* Stat row */}
        <div className="grid grid-cols-2 border-y-2 border-ink">
          <div className="px-4 py-3 border-r-2 border-ink">
            <p className="text-[11px] font-extrabold uppercase tracking-widest text-neutral-700 mb-1">Genres</p>
            <p className="text-[15px] font-extrabold text-ink leading-tight">
              {musician.genres.length > 0 ? musician.genres.slice(0, 2).join(', ') : '—'}
            </p>
          </div>
          <div className="px-4 py-3">
            <p className="text-[11px] font-extrabold uppercase tracking-widest text-neutral-700 mb-1">Looking for</p>
            <p className="text-[15px] font-extrabold text-ink leading-tight">
              {musician.lookingFor ? musician.lookingFor.split(',')[0].trim() : '—'}
            </p>
          </div>
        </div>

        {/* Tags */}
        {musician.instruments.length > 0 && (
          <div className="px-4 pt-4">
            <p className="text-[11px] font-extrabold uppercase tracking-widest text-neutral-700 mb-2">Instruments</p>
            <div className="flex flex-wrap gap-1.5">
              {musician.instruments.map(i => <span key={i} className="tag">{i}</span>)}
            </div>
          </div>
        )}

        {musician.genres.length > 0 && (
          <div className="px-4 pt-4">
            <p className="text-[11px] font-extrabold uppercase tracking-widest text-neutral-700 mb-2">Genres</p>
            <div className="flex flex-wrap gap-1.5">
              {musician.genres.map(g => <span key={g} className="tag">{g}</span>)}
            </div>
          </div>
        )}

        {/* Bio */}
        {musician.bio && (
          <div className="px-4 pt-4 pb-4">
            <p className="text-[11px] font-extrabold uppercase tracking-widest text-neutral-700 mb-2">Bio</p>
            <p className="text-sm text-neutral-700 leading-relaxed">{musician.bio}</p>
          </div>
        )}

        {/* Bottom padding so sticky footer doesn't overlap */}
        <div className="h-16" />
      </div>

      {/* Sticky footer */}
      <div className="flex-shrink-0 grid grid-cols-2 border-t-4 border-ink">
        {isOwnProfile ? (
          <button
            onClick={onEditProfile ?? onClose}
            className="col-span-2 h-14 bg-accent hover:bg-accent-600 text-white font-extrabold text-sm flex items-center justify-between px-4 transition-colors"
          >
            <span className="flex items-center gap-2"><Pencil size={14} /> Edit My Profile</span>
            <span>→</span>
          </button>
        ) : (
          <>
            <button className="h-14 bg-accent hover:bg-accent-600 text-white font-extrabold text-sm flex items-center justify-between px-4 transition-colors">
              <span className="flex items-center gap-2"><MessageSquare size={14} /> Message</span>
              <span>→</span>
            </button>
            <button className="h-14 border-l-2 border-ink bg-transparent hover:bg-accent-100 text-ink font-extrabold text-sm flex items-center justify-between px-4 transition-colors">
              {musician.contactEmail ? (
                <a href={`mailto:${musician.contactEmail}`} className="flex items-center gap-2 w-full" onClick={e => e.stopPropagation()}>
                  <Mail size={14} /> Contact
                </a>
              ) : (
                <span>Request contact</span>
              )}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
