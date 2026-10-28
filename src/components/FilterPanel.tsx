import { X } from 'lucide-react'
import { useStore } from '../store'
import { GENRE_OPTIONS, LOOKING_FOR_OPTIONS, DISTANCE_OPTIONS, distanceLabel } from '../types'

const INSTRUMENT_OPTIONS = [
  { label: 'Drums', values: ['Drums'] },
  { label: 'Bass', values: ['Bass'] },
  { label: 'Guitar', values: ['Guitar'] },
  { label: 'Vocals', values: ['Vocals'] },
  { label: 'Keys', values: ['Keyboard / Piano', 'Synthesizer'] },
  { label: 'Sax', values: ['Saxophone'] },
  { label: 'Trumpet', values: ['Trumpet'] },
  { label: 'Violin', values: ['Violin', 'Cello'] },
  { label: 'DJ', values: ['DJ / Producer'] },
  { label: 'Other', values: ['Other'] },
]

import type { Level } from '../types'

const LEVEL_OPTIONS: { value: Level; label: string }[] = [
  { value: 'Beginner', label: 'Beg' },
  { value: 'Intermediate', label: 'Int' },
  { value: 'Advanced', label: 'Adv' },
  { value: 'Pro', label: 'Pro' },
]

interface Props {
  isMobile?: boolean
}

export default function FilterPanel({ isMobile = false }: Props) {
  const { filters, setFilters, resetFilters, setShowFilterPanel, filteredMusicians } = useStore()
  const count = filteredMusicians().length

  const toggleGenre = (g: string) => {
    const genres = filters.genres.includes(g)
      ? filters.genres.filter(x => x !== g)
      : [...filters.genres, g]
    setFilters({ genres })
  }

  const toggleLookingFor = (lf: string) => {
    const lookingFor = filters.lookingFor.includes(lf)
      ? filters.lookingFor.filter(x => x !== lf)
      : [...filters.lookingFor, lf]
    setFilters({ lookingFor })
  }

  const toggleInstrument = (values: string[]) => {
    const allActive = values.every(v => filters.instruments.includes(v))
    const next = allActive
      ? filters.instruments.filter(i => !values.includes(i))
      : [...new Set([...filters.instruments, ...values])]
    setFilters({ instruments: next })
  }

  const instrumentActive = (values: string[]) => values.some(v => filters.instruments.includes(v))

  const close = () => setShowFilterPanel(false)

  return (
    <div className={isMobile ? 'flex flex-col h-full bg-ground' : 'bg-ground border-b-4 border-ink'}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b-2 border-ink flex-shrink-0">
        <h2 className="text-[22px] font-extrabold text-ink">Filters</h2>
        <div className="flex items-center gap-4">
          <button
            onClick={resetFilters}
            className="text-[13px] font-semibold text-ink underline underline-offset-2 hover:text-accent-700 transition-colors"
          >
            Reset
          </button>
          <button
            onClick={close}
            className="w-8 h-8 flex items-center justify-center hover:bg-accent-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Scrollable content */}
      <div className={`px-4 py-4 space-y-6 ${isMobile ? 'flex-1 overflow-y-auto' : 'overflow-y-auto max-h-[min(340px,45vh)]'}`}>
        {/* Online + Distance row */}
        <section>
          <div className="flex items-center gap-3">
            {/* Online toggle */}
            <button
              onClick={() => setFilters({ onlineOnly: !filters.onlineOnly })}
              className="flex items-center gap-2 flex-shrink-0 hover:bg-accent-100 transition-colors -mx-1 px-1 py-1"
            >
              <div className={`w-10 h-6 flex-shrink-0 border-2 border-ink relative transition-colors ${filters.onlineOnly ? 'bg-accent' : 'bg-white'}`}>
                <div className={`absolute top-0.5 w-4 h-4 bg-white border-2 border-ink transition-all ${filters.onlineOnly ? 'left-[18px]' : 'left-0.5'}`} />
              </div>
              <span className={`text-[13px] font-extrabold whitespace-nowrap transition-colors ${filters.onlineOnly ? 'text-ink' : 'text-neutral-400'}`}>Online</span>
            </button>
            {/* Distance select */}
            <div className="relative">
              <select
                value={filters.distanceMi}
                onChange={e => setFilters({ distanceMi: Number(e.target.value) as typeof filters.distanceMi })}
                className="h-8 pl-2.5 pr-6 border-2 border-ink text-[13px] font-bold text-ink bg-white cursor-pointer focus:outline-none appearance-none"
              >
                {DISTANCE_OPTIONS.map(d => (
                  <option key={d} value={d}>{distanceLabel(d)}</option>
                ))}
              </select>
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-ink pointer-events-none">▾</span>
            </div>
          </div>
        </section>

        {/* Instrument */}
        <section>
          <p className="text-[11px] font-extrabold uppercase tracking-widest text-neutral-700 mb-2">Instrument</p>
          <div className="flex flex-wrap gap-1.5">
            {INSTRUMENT_OPTIONS.map(({ label, values }) => {
              const active = instrumentActive(values)
              return (
                <button
                  key={label}
                  onClick={() => toggleInstrument(values)}
                  className={`h-[34px] px-2.5 border-2 border-ink text-[13px] font-semibold transition-colors ${
                    active ? 'bg-ink text-white' : 'bg-transparent text-ink hover:bg-accent-100'
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </section>

        {/* Skill level */}
        <section>
          <p className="text-[11px] font-extrabold uppercase tracking-widest text-neutral-700 mb-2">Skill level</p>
          <div className="border-2 border-ink grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
            {LEVEL_OPTIONS.map(({ value, label }, i) => {
              const checked = filters.levels.includes(value)
              const toggle = () => {
                const next = checked
                  ? filters.levels.filter(x => x !== value)
                  : [...filters.levels, value]
                setFilters({ levels: next })
              }
              return (
                <button
                  key={value}
                  onClick={toggle}
                  title={value}
                  className={`h-10 text-[12px] font-extrabold transition-colors ${i > 0 ? 'border-l-2 border-ink' : ''} ${
                    checked ? 'bg-ink text-white' : 'text-ink hover:bg-accent-100'
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </section>

        {/* Genre */}
        <section>
          <p className="text-[11px] font-extrabold uppercase tracking-widest text-neutral-700 mb-2">Genre</p>
          <div className="flex flex-wrap gap-1.5">
            {GENRE_OPTIONS.map(g => (
              <button
                key={g}
                onClick={() => toggleGenre(g)}
                className={`h-[34px] px-2.5 border-2 border-ink text-[13px] font-semibold transition-colors ${
                  filters.genres.includes(g) ? 'bg-ink text-white' : 'bg-transparent text-ink hover:bg-accent-100'
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        </section>


        {/* Looking for */}
        <section>
          <p className="text-[11px] font-extrabold uppercase tracking-widest text-neutral-700 mb-2">Looking for</p>
          <div className="grid grid-cols-2 gap-0.5">
            {LOOKING_FOR_OPTIONS.map(lf => {
              const checked = filters.lookingFor.includes(lf)
              return (
                <button
                  key={lf}
                  onClick={() => toggleLookingFor(lf)}
                  className="flex items-center gap-2 py-2 px-1 text-left hover:bg-accent-100 transition-colors"
                >
                  <div className={`w-[22px] h-[22px] flex-shrink-0 border-2 border-ink flex items-center justify-center transition-colors ${checked ? 'bg-accent' : ''}`}>
                    {checked && <span className="text-white text-[13px] font-extrabold leading-none">✓</span>}
                  </div>
                  <span className="text-[13px] font-semibold text-ink leading-tight">{lf}</span>
                </button>
              )
            })}
          </div>
        </section>
      </div>

      {/* Mobile sticky footer */}
      {isMobile && (
        <div className="flex-shrink-0 border-t-2 border-ink p-4">
          <button
            onClick={close}
            className="w-full h-[52px] bg-accent hover:bg-accent-600 text-white font-extrabold text-sm flex items-center justify-between px-4 transition-colors"
          >
            <span>Show {count} {count === 1 ? 'musician' : 'musicians'}</span>
            <span>→</span>
          </button>
        </div>
      )}
    </div>
  )
}
