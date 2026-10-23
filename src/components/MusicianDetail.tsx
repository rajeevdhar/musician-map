import { useRef, useState } from 'react'
import type { Musician } from '../types'
import { useStore } from '../store'
import { ArrowLeft, X, Heart, MapPin, Pencil, MessageSquare, Globe, Instagram, Youtube, Music, Play, Pause } from 'lucide-react'
import { getInstrumentCode } from '../lib/musicianUtils'
import { isOnline, presenceText } from '../lib/presence'

interface Props {
  musician: Musician
  onClose: () => void
  isMobile?: boolean
  onEditProfile?: () => void
  onOpenMessages?: (id: string) => void
}

export default function MusicianDetail({ musician, onClose, isMobile = false, onEditProfile, onOpenMessages }: Props) {
  const { currentUser, saved, toggleSaved, contactRequests, revealedContacts, requestContact } = useStore()
  const isOwnProfile = currentUser?.id === musician.id
  const code = getInstrumentCode(musician.instruments)
  const online = isOnline(musician.lastSeenAt)
  const isSeed = musician.id.startsWith('seed-')
  const isSaved = saved[musician.id] !== undefined
  const outgoingStatus = contactRequests.outgoing[musician.id]
  const revealed = revealedContacts[musician.id]
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)

  const toggleAudio = () => {
    if (!audioRef.current) return
    if (playing) { audioRef.current.pause(); setPlaying(false) }
    else { audioRef.current.play(); setPlaying(true) }
  }

  const socialLinks = [
    { url: musician.websiteUrl, Icon: Globe, label: 'Website' },
    { url: musician.instagramUrl, Icon: Instagram, label: 'Instagram' },
    { url: musician.youtubeUrl, Icon: Youtube, label: 'YouTube' },
    { url: musician.soundcloudUrl, Icon: Music, label: 'SoundCloud' },
  ].filter(l => l.url)

  return (
    <div className="flex flex-col h-full">
      {/* Photo area */}
      <div className="w-full aspect-square bg-neutral-300 relative flex-shrink-0 overflow-hidden">
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
        {!isOwnProfile && currentUser && (
          <button
            onClick={() => toggleSaved(musician.id)}
            className={`absolute top-3 right-3 w-10 h-10 bg-ground border-2 border-ink flex items-center justify-center hover:bg-accent-100 transition-colors ${isSaved ? 'text-accent' : 'text-ink'}`}
          >
            <Heart size={18} fill={isSaved ? 'currentColor' : 'none'} />
          </button>
        )}
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {/* Accent header block */}
        <div className="bg-accent border-t-2 border-ink px-4 pt-3.5 pb-4">
          <p className="text-[11px] font-extrabold uppercase tracking-widest text-white/70 mb-1 flex items-center gap-1.5">
            <span
              className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${online ? 'bg-green-400' : 'bg-white/30'}`}
              title={online ? 'Online now' : presenceText(musician.lastSeenAt) ?? 'Offline'}
            />
            {code} · {musician.instruments[0] ?? 'Musician'}
            {online ? ' · Online now' : presenceText(musician.lastSeenAt) ? ` · ${presenceText(musician.lastSeenAt)}` : ''}
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

        {/* Revealed contact info */}
        {revealed && (
          <div className="mx-4 mt-4 border-2 border-accent bg-accent-100 p-3">
            <p className="text-[11px] font-extrabold uppercase tracking-widest text-accent-700 mb-2">
              Contact shared with you
            </p>
            <p className="text-[16px] font-extrabold text-ink">{revealed.email}</p>
            {revealed.phone && <p className="text-[16px] font-extrabold text-ink mt-1">{revealed.phone}</p>}
          </div>
        )}

        {/* Bio */}
        {musician.bio && (
          <div className="px-4 pt-4">
            <p className="text-[11px] font-extrabold uppercase tracking-widest text-neutral-700 mb-2">Bio</p>
            <p className="text-sm text-neutral-700 leading-relaxed">{musician.bio}</p>
          </div>
        )}

        {/* Audio clip */}
        {musician.audioUrl && (
          <div className="px-4 pt-4">
            <p className="text-[11px] font-extrabold uppercase tracking-widest text-neutral-700 mb-2">Audio</p>
            <div className="flex items-center gap-3 border-2 border-ink px-3 py-2">
              <button
                onClick={toggleAudio}
                className="w-9 h-9 flex-shrink-0 bg-accent hover:bg-accent-600 text-white flex items-center justify-center transition-colors"
              >
                {playing ? <Pause size={16} /> : <Play size={16} />}
              </button>
              <span className="text-[12px] font-semibold text-neutral-700 truncate">
                {playing ? 'Playing…' : 'Play clip'}
              </span>
              <audio
                ref={audioRef}
                src={musician.audioUrl}
                onEnded={() => setPlaying(false)}
                className="hidden"
              />
            </div>
          </div>
        )}

        {/* Social links */}
        {socialLinks.length > 0 && (
          <div className="px-4 pt-4">
            <p className="text-[11px] font-extrabold uppercase tracking-widest text-neutral-700 mb-2">Links</p>
            <div className="flex flex-wrap gap-2">
              {socialLinks.map(({ url, Icon, label }) => (
                <a
                  key={label}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 h-8 px-3 border-2 border-ink text-[12px] font-extrabold text-ink hover:bg-accent-100 transition-colors"
                >
                  <Icon size={13} />
                  {label}
                </a>
              ))}
            </div>
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
            {isSeed || !currentUser ? (
              <button
                disabled
                className="h-14 bg-accent opacity-40 text-white font-extrabold text-sm flex items-center justify-between px-4 col-span-2"
              >
                <span className="flex items-center gap-2"><MessageSquare size={14} /> Message</span>
                <span className="text-xs font-normal opacity-70">Sign in to message</span>
              </button>
            ) : (
              <>
                <button
                  onClick={() => onOpenMessages?.(musician.id)}
                  className="h-14 bg-accent hover:bg-accent-600 text-white font-extrabold text-sm flex items-center justify-between px-4 transition-colors"
                >
                  <span className="flex items-center gap-2"><MessageSquare size={14} /> Message</span>
                  <span>→</span>
                </button>
                <button
                  onClick={() => { if (!outgoingStatus) requestContact(musician.id) }}
                  className={`h-14 border-l-2 border-ink font-extrabold text-sm flex items-center justify-between px-4 transition-colors ${
                    outgoingStatus
                      ? 'bg-transparent text-neutral-500 cursor-default'
                      : 'bg-transparent hover:bg-accent-100 text-ink'
                  }`}
                >
                  <span>
                    {outgoingStatus === 'pending' ? 'Requested' :
                     outgoingStatus === 'accepted' ? 'Accepted' :
                     outgoingStatus === 'declined' ? 'Declined' :
                     'Request contact'}
                  </span>
                  {!outgoingStatus && <span>→</span>}
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
