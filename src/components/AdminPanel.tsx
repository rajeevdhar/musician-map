import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { Musician } from '../types'
import { useStore } from '../store'
import ProfileModal from './ProfileModal'
import { isOnline, presenceText } from '../lib/presence'
import { PUBLIC_PROFILE_COLUMNS } from '../lib/profileColumns'

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

interface Report {
  id: string
  reason: string
  details: string
  status: string
  created_at: string
  reported_profile_id: string
  reporter_id: string
  profiles: { display_name: string; avatar_url?: string } | null
}

const REASON_LABELS: Record<string, string> = {
  inappropriate_image: 'Inappropriate photo',
  offensive_content: 'Offensive content',
  harassment: 'Harassment',
  spam: 'Spam',
  fake_profile: 'Fake profile',
  other: 'Other',
}

export default function AdminPanel({ onClose }: Props) {
  const { musicians, fetchMusicians } = useStore()
  const [dbProfiles, setDbProfiles] = useState<Musician[]>([])
  const [userStats, setUserStats] = useState<Record<string, UserStat>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [actionState, setActionState] = useState<Record<ActionKey, boolean>>({})
  const [search, setSearch] = useState('')
  const [editTarget, setEditTarget] = useState<Musician | null>(null)
  const [activeTab, setActiveTab] = useState<'profiles' | 'reports'>('profiles')
  const [reports, setReports] = useState<Report[]>([])
  const [reportsLoading, setReportsLoading] = useState(false)
  const [chromeOffset, setChromeOffset] = useState(0)

  useEffect(() => { loadAll() }, [])

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const update = () => setChromeOffset(vv.offsetTop)
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    update()
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])

  const adminFetch = async (path: string, method: string) => {
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(path, {
      method,
      headers: { Authorization: `Bearer ${session?.access_token}` },
    })
    return res.json()
  }

  const loadReports = async () => {
    setReportsLoading(true)
    const result = await adminFetch('/api/admin/reports', 'GET')
    setReports(result.reports ?? [])
    setReportsLoading(false)
  }

  const handleReportStatus = async (reportId: string, status: string) => {
    setActionState(s => ({ ...s, [`report-${reportId}`]: true }))
    const { data: { session } } = await supabase.auth.getSession()
    await fetch(`/api/admin/reports/${reportId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${session?.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    setReports(r => r.map(rep => rep.id === reportId ? { ...rep, status } : rep))
    setActionState(s => { const n = { ...s }; delete n[`report-${reportId}`]; return n })
  }

  const loadAll = async () => {
    setIsLoading(true)
    const [profilesResult, statsResult, contactsResult] = await Promise.all([
      supabase.from('profiles').select(PUBLIC_PROFILE_COLUMNS).order('created_at', { ascending: false }),
      adminFetch('/api/admin/user-stats', 'GET'),
      adminFetch('/api/admin/contacts', 'GET'),
    ])

    // Private details come from admin-only server endpoint (service role), not the public table
    const contactById: Record<string, { email?: string; contactEmail?: string; phone?: string | null }> = {}
    for (const c of contactsResult.contacts ?? []) contactById[c.id] = c

    setDbProfiles(((profilesResult.data ?? []) as any[]).map(row => ({
      id: row.id,
      email: contactById[row.id]?.email,
      displayName: row.display_name,
      bio: row.bio ?? '',
      instruments: row.instruments ?? [],
      genres: row.genres ?? [],
      contactEmail: contactById[row.id]?.contactEmail ?? '',
      lat: row.lat,
      lng: row.lng,
      locationName: row.location_name ?? '',
      lookingFor: row.looking_for ?? '',
      avatarUrl: row.avatar_url ?? undefined,
      createdAt: row.created_at,
      lastSeenAt: row.last_seen_at ?? undefined,
      isTest: row.is_test ?? false,
      offersLessons: row.offers_lessons ?? false,
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

  const registeredOnMap = musicians.filter(m => !m.isTest).length
  const onlineCount = dbProfiles.filter(m => isOnline(m.lastSeenAt)).length
  const testCount = dbProfiles.filter(m => m.isTest).length

  const filtered = dbProfiles.filter(m =>
    !search.trim() ||
    m.displayName.toLowerCase().includes(search.toLowerCase()) ||
    (m.email ?? '').toLowerCase().includes(search.toLowerCase()) ||
    m.locationName.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <>
      <div className="modal-backdrop" style={{ alignItems: 'flex-start', paddingTop: `${chromeOffset + 16}px` }} onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
        <div className="modal-box" style={{ maxWidth: '720px', display: 'flex', flexDirection: 'column', height: `calc(100dvh - ${chromeOffset + 32}px)`, overflowY: 'hidden' }}>
          {/* Tabs + close */}
          <div className="flex-shrink-0 flex items-center border-b-2 border-ink px-6">
            <button
              onClick={() => setActiveTab('profiles')}
              className={`px-4 py-2.5 text-xs font-extrabold uppercase tracking-widest transition-colors border-b-2 -mb-[2px] ${activeTab === 'profiles' ? 'border-accent text-accent' : 'border-transparent text-neutral-500 hover:text-ink'}`}
            >
              Profiles
            </button>
            <button
              onClick={() => { setActiveTab('reports'); if (reports.length === 0) loadReports() }}
              className={`px-4 py-2.5 text-xs font-extrabold uppercase tracking-widest transition-colors border-b-2 -mb-[2px] flex items-center gap-1.5 ${activeTab === 'reports' ? 'border-accent text-accent' : 'border-transparent text-neutral-500 hover:text-ink'}`}
            >
              Reports
              {reports.filter(r => r.status === 'pending').length > 0 && (
                <span className="bg-accent text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-sm">
                  {reports.filter(r => r.status === 'pending').length}
                </span>
              )}
            </button>
            <button onClick={onClose} className="ml-auto text-neutral-500 hover:text-ink text-2xl leading-none flex-shrink-0 pl-4 py-2.5">×</button>
          </div>

          <div className="overflow-y-auto flex-1 min-h-0">
          {activeTab === 'profiles' && (
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-4 gap-0 border-2 border-ink">
                <div className="p-2 text-center border-r-2 border-ink">
                  <p className="text-xl font-extrabold text-ink">{dbProfiles.length}</p>
                  <p className="text-[10px] font-extrabold text-neutral-700 uppercase tracking-wide mt-0.5">Reg'd</p>
                </div>
                <div className="p-2 text-center border-r-2 border-ink">
                  <p className="text-xl font-extrabold text-ink">{registeredOnMap}</p>
                  <p className="text-[10px] font-extrabold text-neutral-700 uppercase tracking-wide mt-0.5">On Map</p>
                </div>
                <div className="p-2 text-center border-r-2 border-ink">
                  <p className="text-xl font-extrabold text-accent">{onlineCount}</p>
                  <p className="text-[10px] font-extrabold text-neutral-700 uppercase tracking-wide mt-0.5">Online</p>
                </div>
                <div className="p-2 text-center">
                  <p className="text-xl font-extrabold text-neutral-400">{testCount}</p>
                  <p className="text-[10px] font-extrabold text-neutral-700 uppercase tracking-wide mt-0.5">Test</p>
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
                    ? 'No profiles in database yet.'
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
                Test profiles are marked TEST and can be edited or deleted. Online = active within last 5 minutes.
              </p>
            </div>
          )}

          {activeTab === 'reports' && (
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-neutral-500">
                  {reportsLoading ? 'Loading…' : `${reports.filter(r => r.status === 'pending').length} pending · ${reports.length} total`}
                </p>
                <button onClick={loadReports} disabled={reportsLoading} className="text-xs text-accent-700 hover:bg-accent-100 disabled:opacity-50 px-2 py-1 border-2 border-ink font-bold transition-colors">
                  ↻ Refresh
                </button>
              </div>
              {reportsLoading ? null : reports.length === 0 ? (
                <div className="text-center py-10 text-gray-400 text-sm">No reports yet.</div>
              ) : (
                <div className="space-y-3">
                  {reports.map(report => (
                    <ReportRow
                      key={report.id}
                      report={report}
                      dbProfiles={dbProfiles}
                      actioning={actionState[`report-${report.id}`] ?? false}
                      onUpdateStatus={(status) => handleReportStatus(report.id, status)}
                      onDeleteProfile={() => handleDeleteProfile(report.reported_profile_id)}
                      onDeleteAccount={() => handleDeleteAccount(report.reported_profile_id)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
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

function ReportRow({
  report, dbProfiles, actioning, onUpdateStatus, onDeleteProfile, onDeleteAccount,
}: {
  report: Report
  dbProfiles: Musician[]
  actioning: boolean
  onUpdateStatus: (status: string) => void
  onDeleteProfile: () => void
  onDeleteAccount: () => void
}) {
  const [confirm, setConfirm] = useState<'profile' | 'account' | null>(null)
  const profile = dbProfiles.find(m => m.id === report.reported_profile_id)
  const statusColors: Record<string, string> = {
    pending: 'bg-accent-100 text-accent-700',
    reviewed: 'bg-neutral-100 text-neutral-600',
    actioned: 'bg-green-100 text-green-700',
    dismissed: 'bg-neutral-100 text-neutral-400',
  }

  return (
    <div className={`border-2 border-ink p-3 space-y-2 ${report.status !== 'pending' ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[9px] font-extrabold uppercase tracking-widest px-1.5 py-0.5 ${statusColors[report.status] ?? ''}`}>
              {report.status}
            </span>
            <span className="text-xs font-extrabold text-accent">{REASON_LABELS[report.reason] ?? report.reason}</span>
            <span className="text-xs text-neutral-500">→ <span className="font-semibold text-ink">{report.profiles?.display_name ?? profile?.displayName ?? report.reported_profile_id.slice(0, 8)}</span></span>
          </div>
          {report.details && (
            <p className="text-xs text-neutral-600 italic">"{report.details}"</p>
          )}
          <p className="text-[10px] text-neutral-400">{new Date(report.created_at).toLocaleString()}</p>
        </div>

        {report.status === 'pending' && !confirm && (
          <div className="flex-shrink-0 flex flex-col gap-1.5 items-end">
            <button onClick={() => onUpdateStatus('dismissed')} disabled={actioning}
              className="px-2.5 py-1 text-xs border-2 border-ink text-neutral-600 hover:bg-accent-100 font-bold disabled:opacity-50">
              Dismiss
            </button>
            <button onClick={() => setConfirm('profile')} disabled={actioning}
              className="px-2.5 py-1 text-xs border-2 border-ink text-neutral-700 hover:bg-accent-100 disabled:opacity-50">
              Remove Profile
            </button>
            <button onClick={() => setConfirm('account')} disabled={actioning}
              className="px-2.5 py-1 text-xs border-2 border-ink text-accent-700 hover:bg-accent-100 disabled:opacity-50">
              Delete Account
            </button>
          </div>
        )}

        {confirm && (
          <div className="flex-shrink-0 flex flex-col gap-1.5 items-end">
            <p className="text-xs text-ink font-bold">{confirm === 'profile' ? 'Remove profile?' : 'Delete account?'}</p>
            <div className="flex gap-1.5">
              <button onClick={() => setConfirm(null)} className="px-2 py-1 text-xs border-2 border-ink text-ink hover:bg-accent-100">Cancel</button>
              <button
                onClick={() => {
                  onUpdateStatus('actioned')
                  confirm === 'profile' ? onDeleteProfile() : onDeleteAccount()
                  setConfirm(null)
                }}
                disabled={actioning}
                className="px-2 py-1 text-xs bg-accent hover:bg-accent-600 text-white font-bold disabled:opacity-50"
              >
                {actioning ? '…' : 'Confirm'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
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
