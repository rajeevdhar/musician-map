import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { Musician } from '../types'
import { useStore } from '../store'
import ProfileModal from './ProfileModal'
import { isOnline, presenceText } from '../lib/presence'

interface Props {
  onClose: () => void
}

type ActionKey = string

interface UserStat {
  id: string
  lastSignInAt: string | null
}

function relativeTime(iso?: string | null): string {
  if (!iso) return 'Never'
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 2) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

export default function AdminPanel({ onClose }: Props) {
  const { musicians, fetchMusicians } = useStore()
  const [dbProfiles, setDbProfiles] = useState<Musician[]>([])
  const [userStats, setUserStats] = useState<Record<string, UserStat>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [actionState, setActionState] = useState<Record<ActionKey, boolean>>({})
  const [search, setSearch] = useState('')
  const [editTarget, setEditTarget] = useState<Musician | null>(null)

  useEffect(() => { loadAll() }, [])

  const adminFetch = async (path: string, method: string) => {
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(path, {
      method,
      headers: { Authorization: `Bearer ${session?.access_token}` },
    })
    return res.json()
  }

  const loadAll = async () => {
    setIsLoading(true)
    const [profilesResult, statsResult] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      adminFetch('/api/admin/user-stats', 'GET'),
    ])

    setDbProfiles((profilesResult.data ?? []).map(row => ({
      id: row.id,
      email: row.email,
      displayName: row.display_name,
      bio: row.bio ?? '',
      instruments: row.instruments ?? [],
      genres: row.genres ?? [],
      contactEmail: row.contact_email ?? '',
      lat: row.lat,
      lng: row.lng,
      locationName: row.location_name ?? '',
      lookingFor: row.looking_for ?? '',
      avatarUrl: row.avatar_url ?? undefined,
      createdAt: row.created_at,
      lastSeenAt: row.last_seen_at ?? undefined,
      isTest: row.is_test ?? false,
    })))

    if (statsResult.users) {
      const map: Record<string, UserStat> = {}
      for (const u of statsResult.users) map[u.id] = u
      setUserStats(map)
    }

    setIsLoading(false)
  }

  const handleDeleteProfile = async (id: string) => {
    setActionState(s => ({ ...s, [id]: true }))
    const result = await adminFetch(`/api/admin/profile/${id}`, 'DELETE')
    if (result.ok) {
      setDbProfiles(p => p.filter(m => m.id !== id))
      await fetchMusicians()
    }
    setActionState(s => { const n = { ...s }; delete n[id]; return n })
  }

  const handleDeleteAccount = async (id: string) => {
    setActionState(s => ({ ...s, [`del-${id}`]: true }))
    const result = await adminFetch(`/api/admin/user/${id}`, 'DELETE')
    if (result.ok) {
      setDbProfiles(p => p.filter(m => m.id !== id))
      await fetchMusicians()
    }
    setActionState(s => { const n = { ...s }; delete n[`del-${id}`]; return n })
  }

  const registeredOnMap = musicians.filter(m => !m.id.startsWith('seed-')).length
  const onlineCount = dbProfiles.filter(m => isOnline(m.lastSeenAt)).length
  const testCount = dbProfiles.filter(m => m.isTest).length

  const filtered = dbProfiles.filter(m =>
    !search.trim() ||
    m.displayName.toLowerCase().includes(search.toLowerCase()) ||
    m.email.toLowerCase().includes(search.toLowerCase()) ||
    m.locationName.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <>
      <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
        <div className="modal-box" style={{ maxWidth: '720px' }}>
          <div className="sticky top-0 bg-white flex items-center justify-between px-6 pt-5 pb-3 border-b border-gray-100 z-10">
            <div className="flex items-center gap-3">
              <div>
                <h2 className="text-xl font-extrabold text-ink">Admin Panel</h2>
                <p className="text-xs text-neutral-700">{dbProfiles.length} profile{dbProfiles.length !== 1 ? 's' : ''} in database</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={loadAll} disabled={isLoading} className="text-xs text-accent-700 hover:bg-accent-100 disabled:opacity-50 px-2 py-1 border-2 border-ink font-bold transition-colors">
                ↻ Refresh
              </button>
              <button onClick={onClose} className="text-neutral-500 hover:text-ink text-2xl leading-none">×</button>
            </div>
          </div>

          <div className="p-6 space-y-5">
            <div className="grid grid-cols-4 gap-0 border-2 border-ink">
              <div className="p-3 text-center border-r-2 border-ink">
                <p className="text-2xl font-extrabold text-ink">{dbProfiles.length}</p>
                <p className="text-[11px] font-extrabold text-neutral-700 uppercase tracking-widest mt-0.5">Registered</p>
              </div>
              <div className="p-3 text-center border-r-2 border-ink">
                <p className="text-2xl font-extrabold text-ink">{registeredOnMap}</p>
                <p className="text-[11px] font-extrabold text-neutral-700 uppercase tracking-widest mt-0.5">On Map</p>
              </div>
              <div className="p-3 text-center border-r-2 border-ink">
                <p className="text-2xl font-extrabold text-accent">{onlineCount}</p>
                <p className="text-[11px] font-extrabold text-neutral-700 uppercase tracking-widest mt-0.5">Online Now</p>
              </div>
              <div className="p-3 text-center">
                <p className="text-2xl font-extrabold text-neutral-400">{testCount}</p>
                <p className="text-[11px] font-extrabold text-neutral-700 uppercase tracking-widest mt-0.5">Test</p>
              </div>
            </div>

            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, email, or city…"
              className="w-full h-12 bg-white border-2 border-ink px-3 text-sm focus:outline-none"
            />

            {isLoading ? (
              <div className="text-center py-10 text-gray-400 text-sm">Loading profiles…</div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-10 text-gray-400 text-sm">
                {dbProfiles.length === 0
                  ? 'No registered profiles yet. Seed musicians are client-side only.'
                  : 'No profiles match your search.'}
              </div>
            ) : (
              <div className="space-y-2">
                {filtered.map(m => (
                  <ProfileRow
                    key={m.id}
                    musician={m}
                    lastSignInAt={userStats[m.id]?.lastSignInAt ?? null}
                    removingProfile={actionState[m.id] ?? false}
                    deletingAccount={actionState[`del-${m.id}`] ?? false}
                    onEdit={() => setEditTarget(m)}
                    onDeleteProfile={() => handleDeleteProfile(m.id)}
                    onDeleteAccount={() => handleDeleteAccount(m.id)}
                  />
                ))}
              </div>
            )}

            <p className="text-xs text-gray-400 border-t border-gray-100 pt-3">
              Seed musicians (Maya Chen, Darius Knight, etc.) are hard-coded client-side and not in the database.
              Only real registered users with saved profiles are listed. Online = active within last 5 minutes.
            </p>
          </div>
        </div>
      </div>

      {editTarget && (
        <ProfileModal
          adminTarget={editTarget}
          onAdminSaved={async () => { setEditTarget(null); await loadAll() }}
          onClose={() => setEditTarget(null)}
        />
      )}
    </>
  )
}

function ProfileRow({
  musician, lastSignInAt, removingProfile, deletingAccount, onEdit, onDeleteProfile, onDeleteAccount,
}: {
  musician: Musician
  lastSignInAt: string | null
  removingProfile: boolean
  deletingAccount: boolean
  onEdit: () => void
  onDeleteProfile: () => void
  onDeleteAccount: () => void
}) {
  const [confirm, setConfirm] = useState<'profile' | 'account' | null>(null)
  const online = isOnline(musician.lastSeenAt)

  return (
    <div className="border-2 border-ink p-3 hover:bg-accent-100 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`w-2 h-2 rounded-full flex-shrink-0 ${online ? 'bg-green-500' : 'bg-neutral-300'}`}
              title={online ? 'Online now' : presenceText(musician.lastSeenAt) ? `Last seen ${presenceText(musician.lastSeenAt)}` : 'Never seen'}
            />
            <span className="font-extrabold text-sm text-ink">{musician.displayName}</span>
            {musician.isTest && (
              <span className="text-[9px] font-extrabold uppercase tracking-widest bg-neutral-200 text-neutral-500 px-1.5 py-0.5">TEST</span>
            )}
            <span className="text-xs text-neutral-500">{musician.email}</span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            {musician.locationName}
            {musician.instruments.length > 0 && ` · ${musician.instruments.slice(0, 2).join(', ')}`}
          </p>
          <div className="flex gap-3 mt-0.5">
            <p className="text-[10px] text-gray-400">
              Joined {new Date(musician.createdAt).toLocaleDateString()}
            </p>
            <p className="text-[10px] text-gray-400">
              Last login: {relativeTime(lastSignInAt)}
            </p>
            {musician.lastSeenAt && (
              <p className="text-[10px] text-gray-400">
                Last seen: {relativeTime(musician.lastSeenAt)}
              </p>
            )}
          </div>
        </div>

        <div className="flex-shrink-0 flex flex-col gap-1.5 items-end">
          {confirm === 'profile' ? (
            <div className="flex gap-1.5">
              <button onClick={() => setConfirm(null)} className="px-2 py-1 text-xs border-2 border-ink text-ink hover:bg-accent-100">
                Cancel
              </button>
              <button
                onClick={() => { setConfirm(null); onDeleteProfile() }}
                disabled={removingProfile}
                className="px-2 py-1 text-xs bg-ink hover:bg-neutral-800 text-white font-bold disabled:opacity-50"
              >
                {removingProfile ? '…' : 'Confirm'}
              </button>
            </div>
          ) : confirm === 'account' ? (
            <div className="flex gap-1.5">
              <button onClick={() => setConfirm(null)} className="px-2 py-1 text-xs border-2 border-ink text-ink hover:bg-accent-100">
                Cancel
              </button>
              <button
                onClick={() => { setConfirm(null); onDeleteAccount() }}
                disabled={deletingAccount}
                className="px-2 py-1 text-xs bg-accent hover:bg-accent-600 text-white font-bold disabled:opacity-50"
              >
                {deletingAccount ? '…' : 'Confirm'}
              </button>
            </div>
          ) : (
            <>
              <button
                onClick={onEdit}
                className="px-2.5 py-1 text-xs border-2 border-ink text-ink hover:bg-accent-100 font-bold"
              >
                Edit
              </button>
              <button
                onClick={() => setConfirm('profile')}
                className="px-2.5 py-1 text-xs border-2 border-ink text-neutral-700 hover:bg-accent-100"
              >
                Remove Profile
              </button>
              <button
                onClick={() => setConfirm('account')}
                className="px-2.5 py-1 text-xs border-2 border-ink text-accent-700 hover:bg-accent-100"
              >
                Delete Account
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
