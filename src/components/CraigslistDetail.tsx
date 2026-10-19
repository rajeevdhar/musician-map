import type { CraigslistPost } from '../types'

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
        {/* Banner */}
        <div className="h-16 bg-gradient-to-br from-orange-400 to-rose-500 relative flex items-center px-5">
          <button onClick={onClose} className="absolute top-3 right-3 text-white/80 hover:text-white text-2xl leading-none">×</button>
          <span className="text-white text-sm font-medium">📢 Craigslist Musicians</span>
        </div>

        <div className="px-5 py-4 space-y-3">
          {/* Title */}
          <div>
            <h2 className="text-base font-bold text-gray-900 leading-tight">{post.title}</h2>
            <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
              <span>📍 {post.locationName}</span>
              <span>📅 {dateStr}</span>
            </div>
          </div>

          {/* Description */}
          {post.description && (
            <p className="text-sm text-gray-600 leading-relaxed line-clamp-5">{post.description}</p>
          )}

          {/* CTA */}
          <a
            href={post.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full text-center bg-orange-500 hover:bg-orange-600 text-white font-medium py-2.5 rounded-xl transition-colors text-sm"
          >
            View Full Post on Craigslist ↗
          </a>

          <p className="text-xs text-center text-gray-400">
            Location is approximate — see the post for details
          </p>
        </div>
      </div>
    </div>
  )
}
