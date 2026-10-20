import type { Musician } from '../types'
import { useStore } from '../store'

interface Props {
  musician: Musician
  onClose: () => void
  onEditProfile?: () => void
}

export default function MusicianDetail({ musician, onClose, onEditProfile }: Props) {
  const { currentUser } = useStore()
  const isOwnProfile = currentUser?.id === musician.id

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-box max-w-sm">
        {/* Avatar banner */}
        <div className="h-20 bg-gradient-to-br from-indigo-500 to-purple-600 relative flex items-end px-5 pb-3">
          <button onClick={onClose} className="absolute top-3 right-3 text-white/80 hover:text-white text-2xl leading-none">×</button>
          <div className="w-14 h-14 rounded-2xl bg-white flex items-center justify-center text-3xl shadow-lg -mb-7 border-2 border-white">
            🎵
          </div>
        </div>

        <div className="pt-9 px-5 pb-5 space-y-4">
          {/* Name & location */}
          <div>
            <h2 className="text-lg font-bold text-gray-900">{musician.displayName}</h2>
            <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
              <span>📍</span> {musician.locationName}
            </p>
          </div>

          {/* Instruments */}
          {musician.instruments.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">Instruments</p>
              <div className="flex flex-wrap gap-1.5">
                {musician.instruments.map(i => (
                  <span key={i} className="tag bg-indigo-50 text-indigo-700">{i}</span>
                ))}
              </div>
            </div>
          )}

          {/* Genres */}
          {musician.genres.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">Genres</p>
              <div className="flex flex-wrap gap-1.5">
                {musician.genres.map(g => (
                  <span key={g} className="tag bg-orange-50 text-orange-700">{g}</span>
                ))}
              </div>
            </div>
          )}

          {/* Looking for */}
          {musician.lookingFor && (
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">Looking for</p>
              <div className="flex flex-wrap gap-1.5">
                {musician.lookingFor.split(',').map(s => s.trim()).filter(Boolean).map(l => (
                  <span key={l} className="tag bg-green-50 text-green-700">{l}</span>
                ))}
              </div>
            </div>
          )}

          {/* Bio */}
          {musician.bio && (
            <p className="text-sm text-gray-600 leading-relaxed">{musician.bio}</p>
          )}

          {/* Contact */}
          {!isOwnProfile && musician.contactEmail && (
            <a
              href={`mailto:${musician.contactEmail}?subject=Hey from MusicianMap!`}
              className="block w-full text-center bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 rounded-xl transition-colors text-sm"
            >
              ✉️ Contact {musician.displayName.split(' ')[0]}
            </a>
          )}

          {isOwnProfile && onEditProfile && (
            <button
              onClick={() => { onClose(); onEditProfile() }}
              className="block w-full text-center bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-medium py-2.5 rounded-xl transition-colors text-sm"
            >
              ✏️ Edit My Profile
            </button>
          )}

          {!currentUser && (
            <p className="text-xs text-center text-gray-400">
              Sign in to contact this musician
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
