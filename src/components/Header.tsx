import { useState, useEffect } from 'react'
import { useStore } from '../store'
import type { City } from '../types'
import { Music2, User, Pencil, Plus, LogOut, Trash2, Shield } from 'lucide-react'

interface Props {
  onShowAuth: () => void
  onShowProfile: () => void
  onShowAdmin: () => void
  isAdmin: boolean
}

export default function Header({ onShowAuth, onShowProfile, onShowAdmin, isAdmin }: Props) {
  const { currentUser, logout, deleteAccount, selectedCityId, fetchCraigslist, currentProfile } = useStore()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [cities, setCities] = useState<City[]>([])
  const [menuOpen, setMenuOpen] = useState(false)
  const profile = currentProfile()

  useEffect(() => {
    fetch('/api/cities')
      .then(r => r.json())
      .then(setCities)
      .catch(() => {})
  }, [])

  const handleCityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    fetchCraigslist(e.target.value)
  }

  const handleDeleteAccount = async () => {
    setMenuOpen(false)
    setConfirmDelete(false)
    await deleteAccount()
  }

  return (
    <header className="absolute top-0 left-0 right-0 z-[1000] flex items-center gap-2 px-3 py-2 pointer-events-none">
      {/* Logo */}
      <div className="pointer-events-auto flex items-center gap-2 bg-ink text-white px-3 py-2 shadow-sm">
        <Music2 size={16} />
        <span className="font-extrabold text-sm hidden sm:block tracking-tight">MUSICIANMAPPER.</span>
      </div>

      {/* City picker for Craigslist */}
      <div className="pointer-events-auto bg-ground border-2 border-ink px-2 py-1.5 flex items-center gap-2 shadow-sm">
        <select
          value={selectedCityId}
          onChange={handleCityChange}
          className="text-sm text-ink bg-transparent border-none outline-none cursor-pointer pr-1"
          title="Craigslist city"
        >
          {cities.length === 0 && <option value="newyork">New York</option>}
          {cities.map(c => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
        </select>
      </div>

      <div className="flex-1" />

      {/* Auth controls */}
      <div className="pointer-events-auto">
        {currentUser ? (
          <div className="relative">
            <button
              onClick={() => setMenuOpen(v => !v)}
              className="flex items-center gap-2 bg-ground border-2 border-ink px-3 py-2 text-sm font-bold text-ink hover:bg-accent-100 shadow-sm"
            >
              {profile ? <Music2 size={14} /> : <User size={14} />}
              <span className="hidden sm:block max-w-[120px] truncate">{currentUser.displayName}</span>
              {isAdmin && <span className="text-[10px] bg-accent-100 text-accent-700 px-1.5 py-0.5 font-extrabold uppercase tracking-wide">admin</span>}
              <span className="text-xs text-neutral-500">▾</span>
            </button>

            {menuOpen && (
              <div
                className="absolute right-0 top-full mt-0 bg-ground border-2 border-ink shadow-lg min-w-[160px]"
                onMouseLeave={() => setMenuOpen(false)}
              >
                {isAdmin && (
                  <>
                    <button
                      onClick={() => { setMenuOpen(false); onShowAdmin() }}
                      className="w-full flex items-center gap-2 px-4 h-10 text-sm font-bold text-accent-700 hover:bg-accent-100"
                    >
                      <Shield size={14} /> Admin Panel
                    </button>
                    <div className="border-t-2 border-ink" />
                  </>
                )}
                <button
                  onClick={() => { setMenuOpen(false); onShowProfile() }}
                  className="w-full flex items-center gap-2 px-4 h-10 text-sm font-semibold text-ink hover:bg-accent-100"
                >
                  {profile ? <><Pencil size={14} /> Edit Profile</> : <><Plus size={14} /> Create Profile</>}
                </button>
                <div className="border-t-2 border-ink" />
                <button
                  onClick={async () => { setMenuOpen(false); await logout() }}
                  className="w-full flex items-center gap-2 px-4 h-10 text-sm font-semibold text-accent-700 hover:bg-accent-100"
                >
                  <LogOut size={14} /> Sign Out
                </button>
                {!confirmDelete ? (
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="w-full flex items-center gap-2 px-4 h-10 text-sm text-neutral-500 hover:bg-accent-100"
                  >
                    <Trash2 size={14} /> Delete Account
                  </button>
                ) : (
                  <div className="px-3 py-2 space-y-1.5 border-t-2 border-ink">
                    <p className="text-xs text-accent-700 font-bold">Delete permanently?</p>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => setConfirmDelete(false)}
                        className="flex-1 py-1 text-xs border-2 border-ink text-ink hover:bg-accent-100"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleDeleteAccount}
                        className="flex-1 py-1 text-xs bg-accent hover:bg-accent-600 text-white font-bold"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={onShowAuth}
            className="bg-accent hover:bg-accent-600 text-white text-sm font-bold px-4 py-2 shadow-sm transition-colors"
          >
            Sign In / Register
          </button>
        )}
      </div>
    </header>
  )
}
