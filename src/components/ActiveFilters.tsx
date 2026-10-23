import { X } from 'lucide-react'
import { useStore } from '../store'

export default function ActiveFilters() {
  const { filters, setFilters, resetFilters } = useStore()

  const chips: { label: string; onRemove: () => void }[] = []

  filters.instruments.forEach(i =>
    chips.push({ label: i, onRemove: () => setFilters({ instruments: filters.instruments.filter(x => x !== i) }) })
  )
  filters.genres.forEach(g =>
    chips.push({ label: g, onRemove: () => setFilters({ genres: filters.genres.filter(x => x !== g) }) })
  )
  filters.levels.forEach(l =>
    chips.push({ label: l, onRemove: () => setFilters({ levels: filters.levels.filter(x => x !== l) }) })
  )
  filters.lookingFor.forEach(lf =>
    chips.push({ label: lf, onRemove: () => setFilters({ lookingFor: filters.lookingFor.filter(x => x !== lf) }) })
  )
  if (filters.onlineOnly)
    chips.push({ label: '● Online now', onRemove: () => setFilters({ onlineOnly: false }) })

  if (chips.length === 0) return null

  return (
    <div className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 border-b-2 border-ink overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
      {chips.map(chip => (
        <button
          key={chip.label}
          onClick={chip.onRemove}
          className="flex-shrink-0 flex items-center gap-1.5 h-7 px-2.5 bg-ink text-white text-[11px] font-extrabold hover:bg-neutral-700 transition-colors"
        >
          {chip.label}
          <X size={9} strokeWidth={3} />
        </button>
      ))}
      {chips.length > 1 && (
        <button
          onClick={resetFilters}
          className="flex-shrink-0 text-[11px] font-semibold text-neutral-500 hover:text-ink transition-colors ml-1 whitespace-nowrap"
        >
          Clear all
        </button>
      )}
    </div>
  )
}
