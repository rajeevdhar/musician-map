import { useStore } from '../store'

export default function MapLegend() {
  const { musicians } = useStore()

  return (
    <div className="absolute bottom-6 left-3 z-[1000] bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg px-4 py-3 text-xs max-w-[210px]">
      <div className="flex items-center gap-2">
        <span className="w-5 h-5 bg-indigo-500 rounded-full border-2 border-white shadow flex-shrink-0" />
        <span className="text-gray-700">
          <span className="font-semibold">{musicians.length}</span> registered musician{musicians.length !== 1 ? 's' : ''}
        </span>
      </div>
    </div>
  )
}
