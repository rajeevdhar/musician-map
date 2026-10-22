import { SlidersHorizontal } from 'lucide-react'
import { useStore } from '../store'

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
  const { filters, setShowFilterPanel, filterCount } = useStore()

  const isActive = (item: typeof FILTER_ITEMS[0]) =>
    item.instruments.some(i => filters.instruments.includes(i))

  const toggle = (item: typeof FILTER_ITEMS[0]) => {
    const active = isActive(item)
    const instruments = active
      ? filters.instruments.filter(i => !item.instruments.includes(i))
      : [...filters.instruments, ...item.instruments]
    setFilters({ instruments })
  }

  const count = filterCount()

  return (
    <div className="hidden lg:flex border-b-2 border-ink bg-accent">
      {FILTER_ITEMS.map((item, i) => {
        const active = isActive(item)
        return (
          <button
            key={item.label}
            onClick={() => toggle(item)}
            className={`flex-1 h-11 pl-3 text-[13px] font-extrabold border-r-2 border-white text-left transition-all ${
              active ? 'bg-white text-accent-700' : 'text-white hover:bg-white/10'
            }`}
            style={{
              boxShadow: active
                ? 'inset 0 3px 4px rgba(0,0,0,0.18)'
                : 'inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -3px 0 rgba(0,0,0,0.18)',
            }}
          >
            {item.label}
          </button>
        )
      })}

      <button
        onClick={() => setShowFilterPanel(true)}
        className="h-11 px-3 bg-ink text-white text-[13px] font-extrabold flex items-center gap-2 hover:bg-neutral-800 transition-colors whitespace-nowrap"
      >
        <SlidersHorizontal size={14} />
        More filters{count > 0 ? ` ${count}` : ''}
      </button>
    </div>
  )
}
