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
  const { filters, setFilters } = useStore()

  const isActive = (item: typeof FILTER_ITEMS[0]) =>
    item.instruments.some(i => filters.instruments.includes(i))

  const toggle = (item: typeof FILTER_ITEMS[0]) => {
    const active = isActive(item)
    const instruments = active
      ? filters.instruments.filter(i => !item.instruments.includes(i))
      : [...filters.instruments, ...item.instruments]
    setFilters({ instruments })
  }

  return (
    <div className="hidden lg:flex border-b-2 border-ink bg-accent" data-tour="filters">
      {FILTER_ITEMS.map((item, i) => {
        const active = isActive(item)
        return (
          <button
            key={item.label}
            onClick={() => toggle(item)}
            className={`flex-1 h-11 pl-3 text-[13px] font-extrabold border-r-2 border-white/30 text-left transition-all relative ${
              active
                ? 'bg-white text-accent-700'
                : 'text-white/60 hover:text-white hover:bg-white/10'
            }`}
          >
            {item.label}
            {active && <span className="absolute bottom-0 left-0 right-0 h-[3px] bg-ink" />}
          </button>
        )
      })}
    </div>
  )
}
