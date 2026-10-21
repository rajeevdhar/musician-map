import type { CraigslistPost } from '../types'
import { MapPin, ExternalLink } from 'lucide-react'

interface Props {
  post: CraigslistPost
  onClose: () => void
}

export default function CraigslistDetail({ post, onClose }: Props) {
  const date = new Date(post.pubDate)
  const dateStr = isNaN(date.getTime()) ? post.pubDate : date.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  })

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-box max-w-sm">
        <div className="h-16 bg-ink relative flex items-center px-5">
          <button onClick={onClose} className="absolute top-3 right-3 text-white/80 hover:text-white text-2xl leading-none">×</button>
          <span className="text-white text-sm font-extrabold uppercase tracking-widest">Craigslist</span>
        </div>

        <div className="px-5 py-4 space-y-3">
          <div>
            <h2 className="text-base font-extrabold text-ink leading-tight">{post.title}</h2>
            <div className="flex items-center gap-3 mt-1 text-xs text-neutral-500">
              <span className="flex items-center gap-1"><MapPin size={10} /> {post.locationName}</span>
              <span>{dateStr}</span>
            </div>
          </div>

          {post.description && (
            <p className="text-sm text-neutral-700 leading-relaxed line-clamp-5">{post.description}</p>
          )}

          <a
            href={post.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between w-full h-[52px] bg-accent hover:bg-accent-600 text-white font-bold px-4 text-sm transition-colors"
          >
            <span className="flex items-center gap-2"><ExternalLink size={14} /> View on Craigslist</span>
            <span>→</span>
          </a>

          <p className="text-xs text-center text-neutral-400">
            Location is approximate — see the post for details
          </p>
        </div>
      </div>
    </div>
  )
}
