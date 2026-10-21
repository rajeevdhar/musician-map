import { useStore } from '../store'

export default function MapLegend() {
  const { musicians, craigslistPosts, isLoadingCL, clError } = useStore()

  return (
    <div className="absolute bottom-6 left-3 z-[1000] bg-ground border-2 border-ink px-4 py-3 text-xs space-y-2 max-w-[210px]">
      <div className="flex items-center gap-2">
        <span className="w-4 h-4 bg-accent flex-shrink-0" />
        <span className="text-neutral-700">
          <span className="font-extrabold">{musicians.length}</span> registered musician{musicians.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <span className="w-4 h-4 bg-ink flex-shrink-0" />
        <span className="text-neutral-700">
          {isLoadingCL ? (
            <span className="text-neutral-400">Loading Craigslist…</span>
          ) : (
            <>
              <span className="font-extrabold">{craigslistPosts.length}</span> Craigslist post{craigslistPosts.length !== 1 ? 's' : ''}
            </>
          )}
        </span>
      </div>

      {clError && (
        <p className="text-accent-700 text-[10px] leading-tight">{clError}</p>
      )}
    </div>
  )
}
