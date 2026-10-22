import { useState } from 'react'
import { useStore } from '../store'
import type { Musician } from '../types'
import { getInstrumentCode, haversineDistanceMiles, formatDistance } from '../lib/musicianUtils'

type SortMode = 'nearest' | 'further' | 'az'

interface Props {
  onViewProfile?: (m: Musician) => void
}

export default function MusicianList({ onViewProfile }: Props) {
  const { filteredMusicians, selectedId, setSelectedId, currentProfile, resetFilters } = useStore()
  const [sort, setSort] = useState<SortMode>('nearest')
  const profile = currentProfile()
  const userLat = profile?.lat
  const userLng = profile?.lng

  const musicians = (() => {
    const list = [...filteredMusicians()]
    if ((sort === 'nearest' || sort === 'further') && userLat != null && userLng != null) {
      list.sort((a, b) => {
        const da = (!isNaN(a.lat) && !isNaN(a.lng)) ? haversineDistanceMiles(userLat, userLng, a.lat, a.lng) : Infinity
        const db = (!isNaN(b.lat) && !isNaN(b.lng)) ? haversineDistanceMiles(userLat, userLng, b.lat, b.lng) : Infinity
        return sort === 'nearest' ? da - db : db - da
      })
    } else if (sort === 'az') {
      list.sort((a, b) => a.displayName.localeCompare(b.displayName))
    }
    return list
  })()

  const toggleSort = () => setSort(s => s === 'nearest' ? 'further' : s === 'further' ? 'az' : 'nearest')

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-end justify-between px-4 pt-4 pb-3 flex-shrink-0 border-b-2 border-ink">
        <div className="flex items-end gap-2">
          <span className="text-[44px] font-extrabold leading-none text-ink tracking-tight">{musicians.length}</span>
          <span className="text-[20px] font-extrabold text-ink pb-0.5">musicians</span>
        </div>
        <button onClick={toggleSort} className="text-[13px] font-semibold text-neutral-700 pb-1 hover:text-ink transition-colors">
          {sort === 'nearest' ? 'Nearest ↓' : sort === 'further' ? 'Furthest ↑' : 'A–Z ↓'}
        </button>
      </div>

      {/* Rows */}
      <div className="overflow-y-auto flex-1">
        {musicians.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 px-8 text-center">
            <p className="text-[20px] font-extrabold text-ink">No one matches yet.</p>
            <p className="text-sm text-neutral-700">Try a wider distance or fewer filters.</p>
            <button
              onClick={resetFilters}
              className="h-[42px] px-5 border-2 border-ink text-sm font-extrabold text-ink hover:bg-accent-100 transition-colors"
            >
              Reset filters
            </button>
          </div>
        ) : (
          musicians.map(m => (
            <MusicianRow
              key={m.id}
              musician={m}
              isSelected={m.id === selectedId}
              userLat={userLat}
              userLng={userLng}
              onClick={() => {
                setSelectedId(m.id)
                onViewProfile?.(m)
              }}
            />
          ))
        )}
      </div>
    </div>
  )
}

function MusicianRow({
  musician: m,
  isSelected,
  userLat,
  userLng,
  onClick,
}: {
  musician: Musician
  isSelected: boolean
  userLat?: number
  userLng?: number
  onClick: () => void
}) {
  const code = getInstrumentCode(m.instruments)
  const distMiles = userLat != null && userLng != null && !isNaN(m.lat) && !isNaN(m.lng)
    ? haversineDistanceMiles(userLat, userLng, m.lat, m.lng)
    : null

  return (
    <button
      onClick={onClick}
      className={`w-full text-left grid border-t-2 border-ink transition-colors hover:bg-accent-100 ${isSelected ? 'bg-accent-100' : ''}`}
      style={{ gridTemplateColumns: '52px 1fr auto' }}
    >
      {/* Code block */}
      <div className="min-h-[52px] m-2 mr-0 bg-accent text-white flex items-start pt-1 pl-1.5 text-[13px] font-extrabold leading-none flex-shrink-0">
        {code}
      </div>

      {/* Middle */}
      <div className="py-2.5 px-3 min-w-0">
        <p className="text-[16px] font-extrabold text-ink leading-tight truncate">{m.displayName}</p>
        {(m.instruments.length > 0 || m.genres.length > 0) && (
          <p className="text-[13px] text-neutral-700 mt-0.5 truncate">
            {[m.instruments.slice(0, 2).join(', '), m.genres.slice(0, 1).join(', ')].filter(Boolean).join(' · ')}
          </p>
        )}
        {m.lookingFor && (
          <p className="text-[12px] font-semibold text-accent-700 mt-0.5 truncate">
            {m.lookingFor.split(',')[0]?.trim()} · {m.locationName.split(',')[0]}
          </p>
        )}
      </div>

      {/* Distance */}
      <div className="flex-shrink-0 border-l-2 border-ink px-4 pt-2.5 flex flex-col justify-start">
        {distMiles != null ? (
          <span className="text-[15px] font-extrabold text-ink whitespace-nowrap">{formatDistance(distMiles)}</span>
        ) : (
          <span className="text-[12px] text-neutral-500 max-w-[60px] leading-tight text-right">{m.locationName.split(',')[0]}</span>
        )}
      </div>
    </button>
  )
}
