import { useStore } from '../store'

export default function MapLegend() {
  const { musicians } = useStore()

  return (
    <div className="absolute bottom-6 left-3 z-[1000] bg-ground border-2 border-ink px-4 py-3 text-xs max-w-[210px]">
      <div className="flex items-center gap-2">
        <span className="w-4 h-4 bg-accent flex-shrink-0" />
        <span className="text-neutral-700">
          <span className="font-extrabold">{musicians.length}</span> registered musician{musicians.length !== 1 ? 's' : ''}
        </span>
      </div>
    </div>
  )
}
