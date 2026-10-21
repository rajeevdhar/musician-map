import { useState } from 'react'
import { useStore } from '../store'

interface Props {
  onShowAuth: () => void
  onShowProfile: () => void
  onShowAdmin: () => void
  isAdmin: boolean
}

export default function Header({ onShowAuth, onShowProfile, onShowAdmin, isAdmin }: Props) {
  const { currentUser, logout, deleteAccount, currentProfile } = useStore()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const profile = currentProfile()

  const handleDeleteAccount = async () => {
    setMenuOpen(false)
    setConfirmDelete(false)
    await deleteAccount()
  }

  return (
    <header className="absolute top-0 left-0 right-0 z-[1000] flex items-center gap-2 px-3 py-2 pointer-events-none">
      {/* Logo */}
      <div className="pointer-events-auto flex items-center gap-2 bg-indigo-700 text-white px-3 py-2 rounded-xl shadow-lg">
        <span className="text-xl">🎸</span>
        <span className="font-bold text-sm hidden sm:block">MusicianMap</span>
      </div>

      <div className="flex-1" />

      {/* Auth controls */}
      <div className="pointer-events-auto">
        {currentUser ? (
          <div className="relative">
            <button
              onClick={() => setMenuOpen(v => !v)}
              className="flex items-center gap-2 bg-white rounded-xl shadow-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <span className="text-base">{profile ? '🎵' : '👤'}</span>
              <span className="hidden sm:block max-w-[120px] truncate">{currentUser.displayName}</span>
              {isAdmin && <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full font-semibold">admin</span>}
              <span className="text-xs text-gray-400">▾</span>
            </button>

            {menuOpen && (
              <div
                className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-xl border border-gray-100 py-1 min-w-[160px]"
                onMouseLeave={() => setMenuOpen(false)}
              >
                {isAdmin && (
                  <>
                    <button
                      onClick={() => { setMenuOpen(false); onShowAdmin() }}
                      className="w-full text-left px-4 py-2 text-sm text-indigo-600 hover:bg-indigo-50 font-medium"
                    >
                      🛡️ Admin Panel
                    </button>
                    <hr className="my-1 border-gray-100" />
                  </>
                )}
                <button
                  onClick={() => { setMenuOpen(false); onShowProfile() }}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  {profile ? '✏️ Edit Profile' : '➕ Create Profile'}
                </button>
                <hr className="my-1 border-gray-100" />
                <button
                  onClick={async () => { setMenuOpen(false); await logout() }}
                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                >
                  🚪 Sign Out
                </button>
                {!confirmDelete ? (
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-red-50"
                  >
                    🗑️ Delete Account
                  </button>
                ) : (
                  <div className="px-3 py-2 space-y-1.5">
                    <p className="text-xs text-red-600 font-medium">Delete account permanently?</p>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => setConfirmDelete(false)}
                        className="flex-1 py-1 text-xs rounded border border-gray-300 text-gray-600 hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleDeleteAccount}
                        className="flex-1 py-1 text-xs rounded bg-red-600 hover:bg-red-700 text-white font-medium"
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
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-xl shadow-lg transition-colors"
          >
            Sign In / Register
          </button>
        )}
      </div>
    </header>
  )
}
