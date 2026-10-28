import { useState } from 'react'
import { SlidersHorizontal, ArrowUpDown } from 'lucide-react'
import { useStore } from '../store'
import type { Musician } from '../types'
import { getInstrumentCode, haversineDistanceMiles, formatDistance, shortLocation } from '../lib/musicianUtils'
import { isOnline } from '../lib/presence'
import { DISTANCE_OPTIONS, distanceLabel } from '../types'

type SortMode = 'nearest' | 'further' | 'az'

interface Props {
  onViewProfile?: (m: Musician) => void
}

export default function MusicianList({ onViewProfile }: Props) {
  const { filteredMusicians, selectedId, setSelectedId, currentProfile, resetFilters, filters, setFilters, setShowFilterPanel, filterCount } = useStore()
  const activeFilterCount = filterCount()
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
      {/* Header — grid matches row columns: 52px | 1fr | auto */}
      <div className="grid border-b-2 border-ink flex-shrink-0" style={{ gridTemplateColumns: '52px 1fr auto' }}>
        {/* Col 1: blank spacer */}
        <div />
        {/* Col 2: big number, then "musicians" stacked above "within X mi" */}
        <div className="py-3 px-3 flex items-center gap-3">
          <span className="text-[72px] font-black leading-none text-ink tracking-tight flex-shrink-0">{musicians.length}</span>
          <div className="flex flex-col justify-center gap-0.5">
            <span className="text-[18px] font-extrabold text-ink leading-none">musicians</span>
            <div className="flex items-center gap-1">
              <span className="text-[11px] font-semibold text-neutral-500">within</span>
              <div className="flex items-center gap-0">
                <select
                  value={filters.distanceMi}
                  onChange={e => setFilters({ distanceMi: Number(e.target.value) as typeof filters.distanceMi })}
                  className="text-[11px] font-bold text-ink bg-transparent cursor-pointer focus:outline-none appearance-none p-0"
                >
                  {DISTANCE_OPTIONS.map(d => (
                    <option key={d} value={d}>{distanceLabel(d)}</option>
                  ))}
                </select>
                <span className="text-[13px] text-ink pointer-events-none leading-none -mt-0.5">▾</span>
              </div>
            </div>
          </div>
        </div>
        {/* Col 3: Filters (boxed button) stacked above Nearest (plain text) */}
        <div className="flex flex-col items-center justify-center gap-2 px-3 py-3">
          <button
            data-tour="filter-btn"
            onClick={() => setShowFilterPanel(true)}
            className="relative flex items-center justify-center gap-1.5 h-8 px-3 border-2 border-ink text-[12px] font-extrabold text-ink hover:bg-accent-100 transition-colors w-full"
          >
            <SlidersHorizontal size={12} />
            Filters
            {activeFilterCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-accent text-white text-[9px] font-extrabold flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>
          <button
            onClick={toggleSort}
            title={sort === 'nearest' ? 'Sort: Nearest first' : sort === 'further' ? 'Sort: Furthest first' : 'Sort: A–Z'}
            className="flex items-center justify-center gap-1 text-[12px] font-extrabold text-ink hover:text-accent transition-colors w-full"
          >
            <ArrowUpDown size={12} />
            {sort === 'nearest' ? 'Nearest' : sort === 'further' ? 'Furthest' : 'A–Z'}
          </button>
        </div>
      </div>

      {/* Rows */}
      <div className="overflow-y-auto flex-1">
        {musicians.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-5 px-5 text-center">
            {/* Scoreboard counter box */}
            <div className="w-full border-4 border-ink relative overflow-hidden flex-shrink-0">
              <div
                className="absolute inset-0 opacity-[0.045]"
                style={{
                  backgroundImage: 'repeating-linear-gradient(45deg, #1a1a1a 0, #1a1a1a 1px, transparent 0, transparent 50%)',
                  backgroundSize: '8px 8px',
                }}
              />
              <div className="relative py-6 flex flex-col items-center">
                <span className="text-[80px] font-black text-accent leading-none select-none">0</span>
                <span className="text-[11px] font-extrabold uppercase tracking-widest text-ink mt-0.5">
                  {activeFilterCount > 0 ? 'matches found' : filters.distanceMi === 0 ? 'musicians yet' : 'in this area'}
                </span>
              </div>
            </div>

            <div>
              <p className="text-[13px] text-neutral-600 leading-relaxed max-w-[210px] mx-auto">
                {activeFilterCount > 0
                  ? 'Your filters are too narrow — try removing some.'
                  : filters.distanceMi === 0
                  ? 'No one has joined yet. Invite a musician near you.'
                  : 'Try expanding the search distance.'}
              </p>
            </div>

            {activeFilterCount > 0 ? (
              <button
                onClick={resetFilters}
                className="h-10 px-6 bg-accent text-white text-[13px] font-extrabold hover:bg-accent-600 transition-colors"
              >
                Reset all filters
              </button>
            ) : filters.distanceMi !== 0 ? (
              <button
                onClick={() => setFilters({ distanceMi: 0 })}
                className="h-10 px-6 border-2 border-ink text-[13px] font-extrabold text-ink hover:bg-accent-100 transition-colors"
              >
                Show worldwide
              </button>
            ) : null}
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
  const online = isOnline(m.lastSeenAt)
  const distMiles = userLat != null && userLng != null && !isNaN(m.lat) && !isNaN(m.lng)
    ? haversineDistanceMiles(userLat, userLng, m.lat, m.lng)
    : null

  return (
    <button
      onClick={onClick}
      className={`group w-full text-left grid border-t-2 border-ink transition-colors hover:bg-accent-100 active:bg-accent-200 relative ${isSelected ? 'bg-accent-100' : ''}`}
      style={{ gridTemplateColumns: '52px 1fr auto' }}
    >
      {/* Selected / hover left stripe */}
      <span className={`absolute left-0 top-0 bottom-0 w-[3px] bg-accent transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />

      {/* Code block */}
      <div className="self-stretch m-2 mr-0 bg-accent group-hover:bg-ink text-white flex items-center justify-center text-[13px] font-extrabold leading-none flex-shrink-0 transition-colors">
        {code}
      </div>

      {/* Middle */}
      <div className="py-2.5 px-3 min-w-0">
        <p className="text-[16px] font-extrabold text-ink group-hover:text-accent leading-tight truncate transition-colors flex items-center gap-1.5">
          {online && <span className="inline-block w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />}
          {m.displayName}
        </p>
        {(m.instruments.length > 0 || m.genres.length > 0) && (
          <p className="text-[13px] text-neutral-700 mt-0.5 truncate">
            {[m.instruments.slice(0, 2).join(', '), m.genres.slice(0, 1).join(', '), m.level || null].filter(Boolean).join(' · ')}
          </p>
        )}
        {m.lookingFor && (
          <p className="text-[12px] font-semibold text-accent-700 mt-0.5 truncate">
            {m.lookingFor.split(',')[0]?.trim()} · {shortLocation(m.locationName)}
          </p>
        )}
      </div>

      {/* Distance */}
      <div className="flex-shrink-0 border-l-2 border-ink px-4 pt-2.5 flex flex-col justify-start">
        {distMiles != null ? (
          <span className="text-[15px] font-extrabold text-ink whitespace-nowrap">{formatDistance(distMiles)}</span>
        ) : (
          <span className="text-[12px] text-neutral-500 max-w-[60px] leading-tight text-right">{shortLocation(m.locationName)}</span>
        )}
      </div>
    </button>
  )
}
