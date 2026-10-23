import { useEffect, useRef, useState } from 'react'
import { useStore } from './store'
import { Map, List, Heart, MessageSquare, User } from 'lucide-react'
import Header from './components/Header'
import FilterBar from './components/FilterBar'
import MusicianMap from './components/MusicianMap'
import MusicianList from './components/MusicianList'
import MusicianDetail from './components/MusicianDetail'
import FilterPanel from './components/FilterPanel'
import ActiveFilters from './components/ActiveFilters'
import SignupScreen from './components/SignupScreen'
import OnboardingFlow from './components/OnboardingFlow'
import SavedTab from './components/SavedTab'
import InboxTab from './components/InboxTab'
import AuthModal from './components/AuthModal'
import ProfileModal from './components/ProfileModal'
import AdminPanel from './components/AdminPanel'
import ResetPasswordModal from './components/ResetPasswordModal'

type Modal = 'auth' | 'profile' | 'admin' | null
export type Theme = 'default' | 'navy' | 'slate'

const BOTTOM_TABS = [
  { id: 'map' as const, Icon: Map, label: 'Map' },
  { id: 'list' as const, Icon: List, label: 'List' },
  { id: 'saved' as const, Icon: Heart, label: 'Saved' },
  { id: 'messages' as const, Icon: MessageSquare, label: 'Messages' },
  { id: 'me' as const, Icon: User, label: 'Me' },
]

export default function App() {
  const { currentUser, initAuth, needsPasswordReset, musicians, selectedId, setSelectedId, activeTab, setActiveTab, showFilterPanel, isAuthReady, setActiveThreadId, unreadCount, toast } = useStore()
  const [modal, setModal] = useState<Modal>(null)
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('mm-theme') as Theme) || 'default')
  const [largeText, setLargeText] = useState(() => localStorage.getItem('mm-fontsize') === 'large')
  const [showMobileDetail, setShowMobileDetail] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [signupDismissed, setSignupDismissed] = useState(false)
  const prevUserRef = useRef(currentUser)

  useEffect(() => { initAuth() }, []) // eslint-disable-line

  useEffect(() => {
    document.documentElement.dataset.theme = theme === 'default' ? '' : theme
    localStorage.setItem('mm-theme', theme)
  }, [theme])

  useEffect(() => {
    document.documentElement.dataset.fontsize = largeText ? 'large' : ''
    localStorage.setItem('mm-fontsize', largeText ? 'large' : '')
  }, [largeText])

  // Reset signup state on logout
  useEffect(() => {
    if (prevUserRef.current && !currentUser) {
      setSignupDismissed(false)
      setShowOnboarding(false)
    }
    prevUserRef.current = currentUser
  }, [currentUser])

  const adminEmail = import.meta.env.VITE_ADMIN_EMAIL
  const isAdmin = !!currentUser && currentUser.email === adminEmail

  const selectedMusician = selectedId ? musicians.find(m => m.id === selectedId) ?? null : null

  const openMusician = (id: string) => setSelectedId(id)

  const showProfile = () => {
    if (!currentUser) { setModal('auth'); return }
    setModal('profile')
  }

  const showSignupScreen = isAuthReady && !currentUser && !signupDismissed && !showOnboarding

  const openMessages = (musicianId: string) => {
    setActiveThreadId(musicianId)
    setActiveTab('messages')
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
        theme={theme}
        onSetTheme={setTheme}
        largeText={largeText}
        onToggleLargeText={() => setLargeText(v => !v)}
      />

      {/* Desktop-only filter bar */}
      <FilterBar />

      {/* Main content area */}
      <div className="flex-1 flex min-h-0 overflow-hidden relative">

        {/* List panel: always on desktop; only on 'list' tab on mobile */}
        <div className={`flex-col border-r-2 border-ink overflow-hidden flex-shrink-0 large-text-zoom ${
          activeTab === 'list' ? 'flex w-full' : 'hidden'
        } lg:flex lg:w-[380px]`}>
          {showFilterPanel && <FilterPanel />}
          <ActiveFilters />
          <MusicianList onViewProfile={(m) => { openMusician(m.id); setShowMobileDetail(true) }} />
        </div>

        {/* Mobile filter panel overlay */}
        {showFilterPanel && (
          <div className="lg:hidden absolute inset-0 z-30 flex flex-col">
            <FilterPanel isMobile />
          </div>
        )}

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
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden lg:hidden">
            {activeTab === 'me' && (
              <div className="flex-1 flex items-center justify-center flex-col gap-4 p-8">
                <button
                  onClick={showProfile}
                  className="flex items-center justify-between h-[52px] bg-accent hover:bg-accent-600 text-white font-bold text-sm px-6 transition-colors"
                >
                  <span>{currentUser ? 'Edit My Profile' : 'Sign In'}</span>
                  <span className="ml-4">→</span>
                </button>
              </div>
            )}
            {activeTab === 'saved' && (
              <SavedTab
                onViewProfile={(id) => { setSelectedId(id); setActiveTab('map'); setShowMobileDetail(true) }}
              />
            )}
            {activeTab === 'messages' && (
              <InboxTab
                onViewProfile={(id) => { setSelectedId(id); setActiveTab('map'); setShowMobileDetail(true) }}
              />
            )}
          </div>
        )}

        {/* Desktop: Saved overlay */}
        {activeTab === 'saved' && (
          <div className="hidden lg:flex absolute inset-0 z-10 bg-ground">
            <div className="flex flex-col w-[420px] border-r-2 border-ink overflow-y-auto">
              <SavedTab
                onViewProfile={(id) => { setSelectedId(id); setActiveTab('map') }}
              />
            </div>
            <div className="flex-1 flex items-center justify-center">
              <p className="text-sm text-neutral-500">Select a saved musician to view their profile.</p>
            </div>
          </div>
        )}

        {/* Desktop: Messages overlay */}
        {activeTab === 'messages' && (
          <div className="hidden lg:flex absolute inset-0 z-10 bg-ground">
            <InboxTab
              onViewProfile={(id) => { setSelectedId(id); setActiveTab('map') }}
            />
          </div>
        )}

        {/* Desktop: detail panel */}
        {selectedId && selectedMusician && (
          <div className="hidden lg:flex w-[420px] flex-shrink-0 flex-col border-l-2 border-ink overflow-y-auto large-text-zoom">
            <MusicianDetail
              musician={selectedMusician}
              onClose={() => setSelectedId(null)}
              onEditProfile={showProfile}
              onOpenMessages={openMessages}
            />
          </div>
        )}

        {/* Mobile: full-screen detail overlay */}
        {showMobileDetail && selectedMusician && (
          <div className="lg:hidden absolute inset-0 z-20 bg-ground flex flex-col overflow-y-auto large-text-zoom">
            <MusicianDetail
              musician={selectedMusician}
              onClose={() => { setShowMobileDetail(false); setSelectedId(null) }}
              isMobile
              onEditProfile={() => { setShowMobileDetail(false); showProfile() }}
              onOpenMessages={(id) => { setShowMobileDetail(false); openMessages(id) }}
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
            <div className="relative">
              <tab.Icon size={20} />
              {tab.id === 'messages' && unreadCount() > 0 && (
                <div className="absolute -top-1 -right-1 w-2 h-2 bg-accent" />
              )}
            </div>
            <span className="text-[11px] font-extrabold uppercase tracking-wide">{tab.label}</span>
          </button>
        ))}
      </nav>

      {/* Signup screen (logged-out users) */}
      {showSignupScreen && (
        <SignupScreen
          onSignedUp={() => setShowOnboarding(true)}
          onLogin={() => setModal('auth')}
          onSkip={() => setSignupDismissed(true)}
        />
      )}

      {/* Onboarding flow (after signup) */}
      {showOnboarding && (
        <OnboardingFlow
          onComplete={() => setShowOnboarding(false)}
          onBack={() => { setShowOnboarding(false); setSignupDismissed(true) }}
        />
      )}

      {/* Overlay modals — rendered after SignupScreen/OnboardingFlow to win z-index */}
      {modal === 'auth' && (
        <AuthModal onClose={() => setModal(null)} />
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

      {/* Toast notification */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[3000] bg-ink text-white text-[14px] font-extrabold px-6 py-3 shadow-xl pointer-events-none whitespace-nowrap">
          {toast}
        </div>
      )}
    </div>
  )
}
