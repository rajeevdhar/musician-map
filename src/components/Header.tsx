import { useState, useEffect, useRef } from 'react'
import { useStore } from '../store'
import { Search, Music2, User, Pencil, Plus, LogOut, Trash2, Shield, Heart, MessageSquare, SlidersHorizontal } from 'lucide-react'
import type { Theme } from '../App'

const THEMES: { id: Theme; color: string; label: string }[] = [
  { id: 'default', color: '#ec3013', label: 'Red' },
  { id: 'navy',    color: '#1a2744', label: 'Navy & Gold' },
  { id: 'slate',   color: '#2a2d35', label: 'Slate & Teal' },
]

interface Props {
  onShowAuth: () => void
  onShowProfile: () => void
  onShowAdmin: () => void
  isAdmin: boolean
  theme: Theme
  onSetTheme: (t: Theme) => void
  largeText: boolean
  onToggleLargeText: () => void
}

async function geocodeLocation(q: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1&addressdetails=1`
    const res = await fetch(url, { headers: { 'Accept-Language': 'en' } })
    const results = await res.json()
    if (!results?.length) return null
    const r = results[0]
    const isPlace = r.class === 'place' || r.class === 'boundary' || r.class === 'postal_code' ||
      ['city','town','village','suburb','county','state','postcode','neighbourhood','municipality','administrative','quarter'].includes(r.type) ||
      ['city','town','village','suburb','county','state','postcode','neighbourhood','municipality','administrative','quarter'].includes(r.addresstype)
    if (!isPlace) return null
    return { lat: parseFloat(r.lat), lng: parseFloat(r.lon) }
  } catch {
    return null
  }
}

const DESKTOP_TABS = [
  { id: 'saved' as const, Icon: Heart, label: 'Saved' },
  { id: 'messages' as const, Icon: MessageSquare, label: 'Messages' },
]

export default function Header({ onShowAuth, onShowProfile, onShowAdmin, isAdmin, theme, onSetTheme, largeText, onToggleLargeText }: Props) {
  const { currentUser, logout, deleteAccount, currentProfile, query, setQuery, setSearchLoc, activeTab, setActiveTab, setShowFilterPanel, filterCount, unreadCount } = useStore()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const profile = currentProfile()
  const geoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (geoTimerRef.current) clearTimeout(geoTimerRef.current)
    if (!query.trim()) { setSearchLoc(null); return }
    geoTimerRef.current = setTimeout(async () => {
      const loc = await geocodeLocation(query.trim())
      setSearchLoc(loc)
    }, 600)
    return () => { if (geoTimerRef.current) clearTimeout(geoTimerRef.current) }
  }, [query]) // eslint-disable-line

  const handleDeleteAccount = async () => {
    setMenuOpen(false)
    setConfirmDelete(false)
    await deleteAccount()
  }

  return (
    <header className="bg-accent flex-shrink-0 relative z-[1100]">
      {/* Desktop: full accent bar grid */}
      <div className="hidden lg:grid h-[68px]" style={{ gridTemplateColumns: '260px 1fr auto' }}>
        {/* Left: wordmark */}
        <div className="flex items-center px-5">
          <span className="text-white text-[18px] font-extrabold tracking-tight">MUSICIANMAPPER.</span>
        </div>

        {/* Center: search */}
        <div className="flex items-center px-4">
          <div className="relative w-full max-w-[560px]" data-tour="search">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Name, instrument, city…"
              className="w-full h-11 bg-white border-0 pl-10 pr-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-accent"
            />
          </div>
        </div>

        {/* Right: nav tabs + user */}
        <div className="flex items-stretch">
          {DESKTOP_TABS.map(tab => {
            const badge = tab.id === 'messages' && unreadCount() > 0
            return (
              <button
                key={tab.id}
                data-tour={tab.id}
                onClick={() => setActiveTab(activeTab === tab.id ? 'map' : tab.id)}
                className={`flex items-center gap-2 h-[68px] px-5 border-l-2 border-white text-[14px] font-extrabold transition-colors ${
                  activeTab === tab.id
                    ? 'bg-white text-accent-700'
                    : 'text-white hover:bg-white/10'
                }`}
              >
                <div className="relative">
                  <tab.Icon size={16} />
                  {badge && (
                    <span className={`absolute -top-1.5 -right-1.5 w-2 h-2 rounded-full ${activeTab === tab.id ? 'bg-accent' : 'bg-white'}`} />
                  )}
                </div>
                {tab.label}
              </button>
            )
          })}

          {/* Large text toggle */}
          <button
            onClick={onToggleLargeText}
            title={largeText ? 'Standard text size' : 'Larger text size'}
            className={`flex items-center border-l-2 border-white h-[68px] px-4 text-[13px] font-extrabold tracking-wide transition-colors ${
              largeText ? 'bg-white text-accent-700' : 'text-white hover:bg-white/10'
            }`}
          >
            Aa
          </button>

          {/* Theme picker */}
          <div className="flex items-center gap-2 border-l-2 border-white px-4">
            {THEMES.map(t => (
              <button
                key={t.id}
                title={t.label}
                onClick={() => onSetTheme(t.id)}
                className="w-5 h-5 rounded-full transition-all flex-shrink-0"
                style={{
                  background: t.color,
                  outline: theme === t.id ? '2px solid #fff' : '2px solid transparent',
                  outlineOffset: '2px',
                }}
              />
            ))}
          </div>

          {/* User menu / Sign In */}
          <div className="flex items-center border-l-2 border-white px-3">
            {currentUser ? (
              <div className="relative">
                <button
                  data-tour="profile-btn"
                  onClick={() => setMenuOpen(v => !v)}
                  className="flex items-center gap-2 bg-white px-3 h-9 text-sm font-bold text-ink hover:bg-accent-100"
                >
                  {profile ? <Music2 size={14} /> : <User size={14} />}
                  <span className="max-w-[120px] truncate">{currentUser.displayName}</span>
                  {isAdmin && <span className="text-[10px] bg-accent-100 text-accent-700 px-1.5 py-0.5 font-extrabold uppercase tracking-wide">admin</span>}
                  <span className="text-xs text-neutral-500">▾</span>
                </button>

                {menuOpen && (
                  <div
                    className="absolute right-0 top-full bg-ground border-2 border-ink shadow-lg min-w-[160px] z-10"
                    onMouseLeave={() => setMenuOpen(false)}
                  >
                    {isAdmin && (
                      <>
                        <button onClick={() => { setMenuOpen(false); onShowAdmin() }} className="w-full flex items-center gap-2 px-4 h-10 text-sm font-bold text-accent-700 hover:bg-accent-100">
                          <Shield size={14} /> Admin Panel
                        </button>
                        <div className="border-t-2 border-ink" />
                      </>
                    )}
                    <button onClick={() => { setMenuOpen(false); onShowProfile() }} className="w-full flex items-center gap-2 px-4 h-10 text-sm font-semibold text-ink hover:bg-accent-100">
                      {profile ? <><Pencil size={14} /> Edit Profile</> : <><Plus size={14} /> Create Profile</>}
                    </button>
                    <div className="border-t-2 border-ink" />
                    <button onClick={async () => { setMenuOpen(false); await logout() }} className="w-full flex items-center gap-2 px-4 h-10 text-sm font-semibold text-accent-700 hover:bg-accent-100">
                      <LogOut size={14} /> Sign Out
                    </button>
                    {!confirmDelete ? (
                      <button onClick={() => setConfirmDelete(true)} className="w-full flex items-center gap-2 px-4 h-10 text-sm text-neutral-500 hover:bg-accent-100">
                        <Trash2 size={14} /> Delete Account
                      </button>
                    ) : (
                      <div className="px-3 py-2 space-y-1.5 border-t-2 border-ink">
                        <p className="text-xs text-accent-700 font-bold">Delete permanently?</p>
                        <div className="flex gap-1.5">
                          <button onClick={() => setConfirmDelete(false)} className="flex-1 py-1 text-xs border-2 border-ink text-ink hover:bg-accent-100">Cancel</button>
                          <button onClick={handleDeleteAccount} className="flex-1 py-1 text-xs bg-accent hover:bg-accent-600 text-white font-bold">Delete</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <button onClick={onShowAuth} className="bg-white text-accent-700 text-sm font-extrabold px-4 h-9 hover:bg-accent-100 transition-colors">
                Sign in
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Mobile: wordmark + search + filter button */}
      <div className="lg:hidden flex items-center gap-2 h-14 px-3">
        <span className="text-white text-[15px] font-extrabold tracking-tight flex-shrink-0">MUSICIANMAPPER.</span>
        <div className="flex-1 relative" data-tour="mobile-search">
          <Search size={16} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Name, instrument, city…"
            className="w-full h-9 bg-white pl-8 pr-2 text-sm text-ink focus:outline-none"
          />
        </div>
        <button
          data-tour="mobile-filters"
          onClick={() => setShowFilterPanel(true)}
          className="relative w-12 h-12 bg-ink flex items-center justify-center flex-shrink-0"
        >
          <SlidersHorizontal size={18} className="text-white" />
          {filterCount() > 0 && (
            <span className="absolute top-1 right-1 w-2 h-2 bg-accent" />
          )}
        </button>
        {currentUser ? (
          <button onClick={onShowProfile} className="w-9 h-9 bg-ground border-2 border-white flex items-center justify-center flex-shrink-0">
            <User size={16} className="text-ink" />
          </button>
        ) : (
          <button onClick={onShowAuth} className="bg-white text-accent-700 text-xs font-extrabold px-3 h-9 flex-shrink-0">
            Sign in
          </button>
        )}
      </div>
    </header>
  )
}
