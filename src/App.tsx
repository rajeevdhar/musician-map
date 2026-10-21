import { useEffect, useState } from 'react'
import { useStore } from './store'
import { Map, List, Heart, MessageSquare, User } from 'lucide-react'
import Header from './components/Header'
import FilterBar from './components/FilterBar'
import MusicianMap from './components/MusicianMap'
import MusicianList from './components/MusicianList'
import MusicianDetail from './components/MusicianDetail'
import AuthModal from './components/AuthModal'
import ProfileModal from './components/ProfileModal'
import AdminPanel from './components/AdminPanel'
import ResetPasswordModal from './components/ResetPasswordModal'

type Modal = 'auth' | 'profile' | 'admin' | null

const BOTTOM_TABS = [
  { id: 'map' as const, Icon: Map, label: 'Map' },
  { id: 'list' as const, Icon: List, label: 'List' },
  { id: 'saved' as const, Icon: Heart, label: 'Saved' },
  { id: 'messages' as const, Icon: MessageSquare, label: 'Messages' },
  { id: 'me' as const, Icon: User, label: 'Me' },
]

export default function App() {
  const { currentUser, initAuth, needsPasswordReset, musicians, selectedId, setSelectedId, activeTab, setActiveTab } = useStore()
  const [modal, setModal] = useState<Modal>(null)
  const [showMobileDetail, setShowMobileDetail] = useState(false)

  useEffect(() => { initAuth() }, []) // eslint-disable-line

  const adminEmail = import.meta.env.VITE_ADMIN_EMAIL
  const isAdmin = !!currentUser && currentUser.email === adminEmail

  const selectedMusician = selectedId ? musicians.find(m => m.id === selectedId) ?? null : null

  const openMusician = (id: string) => {
    setSelectedId(id)
  }

  const handleRegistered = () => setModal('profile')

  const showProfile = () => {
    if (!currentUser) { setModal('auth'); return }
    setModal('profile')
  }

  // Close mobile detail when selection changes
  useEffect(() => {
    if (!selectedId) setShowMobileDetail(false)
  }, [selectedId])

  return (
    <div className="h-screen flex flex-col bg-ground text-ink font-sans">
      <Header
        onShowAuth={() => setModal('auth')}
        onShowProfile={showProfile}
        onShowAdmin={() => setModal('admin')}
        isAdmin={isAdmin}
      />

      {/* Desktop-only filter bar */}
      <FilterBar />

      {/* Main content area */}
      <div className="flex-1 flex min-h-0 overflow-hidden relative">

        {/* List panel: always on desktop; only on 'list' tab on mobile */}
        <div className={`flex-col border-r-2 border-ink overflow-hidden flex-shrink-0 ${
          activeTab === 'list' ? 'flex w-full' : 'hidden'
        } lg:flex lg:w-[380px]`}>
          <MusicianList onViewProfile={(m) => { openMusician(m.id); setShowMobileDetail(true) }} />
        </div>

        {/* Map area: always on desktop; only on 'map' tab on mobile */}
        <div className={`flex-1 relative min-h-0 ${
          activeTab === 'map' ? 'flex' : 'hidden'
        } lg:flex`}>
          <MusicianMap />

          {/* Mobile bottom card: shown when musician selected on map */}
          {selectedMusician && activeTab === 'map' && !showMobileDetail && (
            <div className="lg:hidden absolute bottom-0 left-0 right-0 z-[999] border-t-2 border-ink bg-ground p-4 shadow-lg">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-extrabold text-ink truncate">{selectedMusician.displayName}</p>
                  <p className="text-sm text-neutral-700 truncate">
                    {selectedMusician.instruments.slice(0, 2).join(', ')} · {selectedMusician.locationName.split(',')[0]}
                  </p>
                </div>
                <button
                  onClick={() => setShowMobileDetail(true)}
                  className="flex items-center justify-between flex-shrink-0 h-11 bg-accent hover:bg-accent-600 text-white font-bold text-sm px-4 transition-colors"
                >
                  View profile →
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Mobile-only other tabs */}
        {activeTab !== 'map' && activeTab !== 'list' && (
          <div className="flex-1 flex items-center justify-center flex-col gap-4 p-8 lg:hidden">
            {activeTab === 'me' ? (
              <button
                onClick={showProfile}
                className="flex items-center justify-between h-[52px] bg-accent hover:bg-accent-600 text-white font-bold text-sm px-6 transition-colors"
              >
                <span>{currentUser ? 'Edit My Profile' : 'Sign In'}</span>
                <span className="ml-4">→</span>
              </button>
            ) : (
              <p className="text-neutral-500 text-sm text-center">
                {activeTab === 'saved' ? 'Saved musicians coming soon.' : 'Messages coming soon.'}
              </p>
            )}
          </div>
        )}

        {/* Desktop: detail panel */}
        {selectedId && selectedMusician && (
          <div className="hidden lg:flex w-[420px] flex-shrink-0 flex-col border-l-2 border-ink overflow-y-auto">
            <MusicianDetail
              musician={selectedMusician}
              onClose={() => setSelectedId(null)}
              onEditProfile={showProfile}
            />
          </div>
        )}

        {/* Mobile: full-screen detail overlay */}
        {showMobileDetail && selectedMusician && (
          <div className="lg:hidden absolute inset-0 z-20 bg-ground flex flex-col overflow-y-auto">
            <MusicianDetail
              musician={selectedMusician}
              onClose={() => { setShowMobileDetail(false); setSelectedId(null) }}
              isMobile
              onEditProfile={() => { setShowMobileDetail(false); showProfile() }}
            />
          </div>
        )}
      </div>

      {/* Mobile bottom tab bar */}
      <nav className="lg:hidden flex-shrink-0 flex border-t-2 border-ink h-14">
        {BOTTOM_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id)
              if (tab.id === 'me') { showProfile(); return }
            }}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 relative transition-colors ${
              activeTab === tab.id ? 'text-accent' : 'text-neutral-500'
            }`}
          >
            {activeTab === tab.id && <div className="absolute top-0 left-0 right-0 h-1 bg-accent" />}
            <tab.Icon size={20} />
            <span className="text-[11px] font-extrabold uppercase tracking-wide">{tab.label}</span>
          </button>
        ))}
      </nav>

      {/* Overlay modals */}
      {modal === 'auth' && (
        <AuthModal onClose={() => setModal(null)} onRegistered={handleRegistered} />
      )}
      {modal === 'profile' && currentUser && (
        <ProfileModal onClose={() => setModal(null)} />
      )}
      {modal === 'admin' && isAdmin && (
        <AdminPanel onClose={() => setModal(null)} />
      )}
      {needsPasswordReset && (
        <ResetPasswordModal onClose={() => useStore.setState({ needsPasswordReset: false })} />
      )}
    </div>
  )
}
