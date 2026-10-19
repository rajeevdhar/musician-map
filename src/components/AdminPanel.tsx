import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { Musician } from '../types'
import { useStore } from '../store'

interface Props {
  onClose: () => void
}

type ActionKey = string // musician.id or `del-${musician.id}`

export default function AdminPanel({ onClose }: Props) {
  const { musicians, fetchMusicians } = useStore()
  const [dbProfiles, setDbProfiles] = useState<Musician[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [actionState, setActionState] = useState<Record<ActionKey, boolean>>({})
  const [search, setSearch] = useState('')

  useEffect(() => { loadProfiles() }, [])

  const loadProfiles = async () => {
    setIsLoading(true)
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })

    setDbProfiles((data ?? []).map(row => ({
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
    })))
    setIsLoading(false)
  }

  const adminFetch = async (path: string, method: string) => {
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(path, {
      method,
      headers: { Authorization: `Bearer ${session?.access_token}` },
    })
    return res.json()
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

  const filtered = dbProfiles.filter(m =>
    !search.trim() ||
    m.displayName.toLowerCase().includes(search.toLowerCase()) ||
    m.email.toLowerCase().includes(search.toLowerCase()) ||
    m.locationName.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-box" style={{ maxWidth: '720px' }}>
        {/* Header */}
        <div className="sticky top-0 bg-white flex items-center justify-between px-6 pt-5 pb-3 border-b border-gray-100 z-10">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🛡️</span>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Admin Panel</h2>
              <p className="text-xs text-gray-500">{dbProfiles.length} profile{dbProfiles.length !== 1 ? 's' : ''} in database</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        <div className="p-6 space-y-5">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-indigo-50 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-indigo-700">{dbProfiles.length}</p>
              <p className="text-xs text-indigo-500 mt-0.5">Registered Users</p>
            </div>
            <div className="bg-emerald-50 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-emerald-700">{registeredOnMap}</p>
              <p className="text-xs text-emerald-500 mt-0.5">Profiles on Map</p>
            </div>
            <div className="bg-orange-50 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-orange-700">8</p>
              <p className="text-xs text-orange-500 mt-0.5">Seed Profiles</p>
            </div>
          </div>

          {/* Search */}
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, email, or city…"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />

          {/* Profile list */}
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
                  removingProfile={actionState[m.id] ?? false}
                  deletingAccount={actionState[`del-${m.id}`] ?? false}
                  onDeleteProfile={() => handleDeleteProfile(m.id)}
                  onDeleteAccount={() => handleDeleteAccount(m.id)}
                />
              ))}
            </div>
          )}

          <p className="text-xs text-gray-400 border-t border-gray-100 pt-3">
            Seed musicians (Maya Chen, Darius Knight, etc.) are hard-coded client-side and not in the database — they won't appear here.
            Only real registered users with saved profiles are listed.
          </p>
        </div>
      </div>
    </div>
  )
}

function ProfileRow({
  musician, removingProfile, deletingAccount, onDeleteProfile, onDeleteAccount,
}: {
  musician: Musician
  removingProfile: boolean
  deletingAccount: boolean
  onDeleteProfile: () => void
  onDeleteAccount: () => void
}) {
  const [confirm, setConfirm] = useState<'profile' | 'account' | null>(null)

  return (
    <div className="border border-gray-200 rounded-xl p-3 hover:border-gray-300 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm text-gray-900">{musician.displayName}</span>
            <span className="text-xs text-gray-400">{musician.email}</span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            {musician.locationName}
            {musician.instruments.length > 0 && ` · ${musician.instruments.slice(0, 2).join(', ')}`}
          </p>
          <p className="text-[10px] text-gray-400 mt-0.5">
            Joined {new Date(musician.createdAt).toLocaleDateString()}
          </p>
        </div>

        <div className="flex-shrink-0 flex flex-col gap-1.5 items-end">
          {confirm === 'profile' ? (
            <div className="flex gap-1.5">
              <button onClick={() => setConfirm(null)} className="px-2 py-1 text-xs rounded border border-gray-300 text-gray-600">
                Cancel
              </button>
              <button
                onClick={() => { setConfirm(null); onDeleteProfile() }}
                disabled={removingProfile}
                className="px-2 py-1 text-xs rounded bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-50"
              >
                {removingProfile ? '…' : 'Confirm'}
              </button>
            </div>
          ) : confirm === 'account' ? (
            <div className="flex gap-1.5">
              <button onClick={() => setConfirm(null)} className="px-2 py-1 text-xs rounded border border-gray-300 text-gray-600">
                Cancel
              </button>
              <button
                onClick={() => { setConfirm(null); onDeleteAccount() }}
                disabled={deletingAccount}
                className="px-2 py-1 text-xs rounded bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
              >
                {deletingAccount ? '…' : 'Confirm'}
              </button>
            </div>
          ) : (
            <>
              <button
                onClick={() => setConfirm('profile')}
                className="px-2.5 py-1 text-xs rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200"
              >
                Remove Profile
              </button>
              <button
                onClick={() => setConfirm('account')}
                className="px-2.5 py-1 text-xs rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200"
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
