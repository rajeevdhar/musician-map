import { useState } from 'react'
import { Ban } from 'lucide-react'
import { useStore } from '../store'
import { getInitials } from '../lib/musicianUtils'

export default function BlockedList() {
  const { blocked, blockedProfiles, unblockUser } = useStore()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const ids = Object.keys(blocked)

  return (
    <div className="border-t-2 border-ink px-4 lg:px-6 py-4">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 py-2 px-4 text-[13px] text-ink hover:bg-accent-100 transition-colors"
      >
        <Ban size={14} />
        Blocked musicians{ids.length > 0 ? ` (${ids.length})` : ''}
      </button>
      {open && (
        <div className="border-2 border-ink mt-2 max-w-sm">
          {ids.length === 0 && (
            <p className="px-4 py-3 text-[13px] text-neutral-500">You haven't blocked anyone.</p>
          )}
          {ids.map((id, i) => {
            // A blocked user who also blocked you (or has no profile) has no readable profile
            const p = blockedProfiles[id]
            const name = p?.displayName ?? 'Musician'
            return (
              <div key={id} className={`flex items-center gap-3 px-3 py-2 ${i > 0 ? 'border-t-2 border-ink' : ''}`}>
                {p?.avatarUrl ? (
                  <img src={p.avatarUrl} alt={name} className="w-8 h-8 object-cover flex-shrink-0 grayscale" />
                ) : (
                  <div className="w-8 h-8 bg-ink text-white text-[12px] font-extrabold flex-shrink-0 flex items-center justify-center select-none">
                    {getInitials(name)}
                  </div>
                )}
                <p className="flex-1 min-w-0 text-[14px] font-extrabold text-ink truncate">{name}</p>
                <button
                  type="button"
                  disabled={busy === id}
                  onClick={async () => { setBusy(id); await unblockUser(id); setBusy(null) }}
                  className="h-8 px-3 border-2 border-ink text-[12px] font-bold text-ink hover:bg-accent-100 disabled:opacity-50 flex-shrink-0"
                >
                  {busy === id ? '…' : 'Unblock'}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
