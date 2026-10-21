import { SlidersHorizontal } from 'lucide-react'
import { useStore } from '../store'

// Filter bar labels → actual INSTRUMENT_OPTIONS values
const FILTER_ITEMS: { label: string; instruments: string[] }[] = [
  { label: 'Drums', instruments: ['Drums'] },
  { label: 'Bass', instruments: ['Bass'] },
  { label: 'Guitar', instruments: ['Guitar'] },
  { label: 'Vocals', instruments: ['Vocals'] },
  { label: 'Keys', instruments: ['Keyboard / Piano', 'Synthesizer'] },
  { label: 'Sax', instruments: ['Saxophone'] },
  { label: 'Trumpet', instruments: ['Trumpet'] },
  { label: 'Violin', instruments: ['Violin', 'Cello'] },
  { label: 'DJ', instruments: ['DJ / Producer'] },
  { label: 'Other', instruments: ['Other', 'Flute', 'Banjo', 'Ukulele', 'Mandolin', 'Harmonica'] },
]

export default function FilterBar() {
  const { filterInstruments, setFilterInstruments, filteredMusicians } = useStore()

  const isActive = (item: typeof FILTER_ITEMS[0]) =>
    item.instruments.some(i => filterInstruments.includes(i))

  const toggle = (item: typeof FILTER_ITEMS[0]) => {
    const active = isActive(item)
    if (active) {
      setFilterInstruments(filterInstruments.filter(i => !item.instruments.includes(i)))
    } else {
      setFilterInstruments([...filterInstruments, ...item.instruments])
    }
  }

  const filterCount = filterInstruments.length

  return (
    <div className="hidden lg:grid border-b-2 border-ink bg-accent" style={{ gridTemplateColumns: 'repeat(10, 1fr) auto' }}>
      {FILTER_ITEMS.map(item => {
        const active = isActive(item)
        return (
          <button
            key={item.label}
            onClick={() => toggle(item)}
            className={`h-11 pl-3 text-[13px] font-extrabold border-r-2 border-white text-left transition-colors ${
              active ? 'bg-white text-accent-700' : 'text-white hover:bg-white/10'
            }`}
          >
            {item.label}
          </button>
        )
      })}
      <button className="h-11 px-3 bg-ink text-white text-[13px] font-extrabold flex items-center gap-2 hover:bg-neutral-800 transition-colors whitespace-nowrap">
        <SlidersHorizontal size={14} />
        More filters{filterCount > 0 ? ` ${filterCount}` : ''}
      </button>
    </div>
  )
}
