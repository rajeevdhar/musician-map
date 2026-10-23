import { useState } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import { useStore } from '../store'
import type { Musician } from '../types'
import { getInstrumentCode, haversineDistanceMiles, formatDistance } from '../lib/musicianUtils'

type SortMode = 'nearest' | 'further' | 'az'

const DISTANCE_OPTIONS = [1, 5, 10, 25, 50, 100, 0] as const
const distanceLabel = (d: number) => d === 0 ? 'World' : `${d} mi`

interface Props {
  onViewProfile?: (m: Musician) => void
}

export default function MusicianList({ onViewProfile }: Props) {
  const { filteredMusicians, selectedId, setSelectedId, currentProfile, resetFilters, filters, setFilters, setShowFilterPanel, filterCount } = useStore()
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
          <span className="text-[60px] font-black leading-none text-ink tracking-tight">{musicians.length}</span>
          <div className="pb-0.5 flex flex-col">
            <span className="text-[20px] font-extrabold text-ink leading-none mb-1">musicians</span>
            <div className="flex items-center gap-1">
              <span className="text-[11px] font-semibold text-neutral-500">within</span>
              <div className="relative">
                <select
                  value={filters.distanceMi}
                  onChange={e => setFilters({ distanceMi: Number(e.target.value) as typeof filters.distanceMi })}
                  className="text-[11px] font-bold text-ink bg-transparent cursor-pointer focus:outline-none appearance-none pr-3"
                >
                  {DISTANCE_OPTIONS.map(d => (
                    <option key={d} value={d}>{distanceLabel(d)}</option>
                  ))}
                </select>
                <span className="absolute right-0 top-1/2 -translate-y-1/2 text-[9px] text-ink pointer-events-none">▾</span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 pb-1">
          <button onClick={toggleSort} className="text-[13px] font-semibold text-neutral-700 hover:text-ink hover:underline underline-offset-2 transition-colors">
            {sort === 'nearest' ? 'Nearest ↑' : sort === 'further' ? 'Furthest ↓' : 'A–Z ↑'}
          </button>
          <button
            onClick={() => setShowFilterPanel(true)}
            className="relative flex items-center gap-1.5 h-8 px-2.5 border-2 border-ink text-[12px] font-extrabold text-ink hover:bg-accent-100 transition-colors"
          >
            <SlidersHorizontal size={12} />
            Filters
            {filterCount() > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-accent text-white text-[9px] font-extrabold flex items-center justify-center">
                {filterCount()}
              </span>
            )}
          </button>
        </div>
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
      className={`group w-full text-left grid border-t-2 border-ink transition-colors hover:bg-accent-100 active:bg-accent-200 ${isSelected ? 'bg-accent-100' : ''}`}
      style={{ gridTemplateColumns: '52px 1fr auto' }}
    >
      {/* Code block */}
      <div className="min-h-[52px] m-2 mr-0 bg-accent group-hover:bg-ink text-white flex items-start pt-1 pl-1.5 text-[13px] font-extrabold leading-none flex-shrink-0 transition-colors">
        {code}
      </div>

      {/* Middle */}
      <div className="py-2.5 px-3 min-w-0">
        <p className="text-[16px] font-extrabold text-ink group-hover:text-accent leading-tight truncate transition-colors">{m.displayName}</p>
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
