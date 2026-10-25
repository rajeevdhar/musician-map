import { useEffect, useRef, useState } from 'react'
import { useStore } from './store'
import { startTour, hasSeenTour } from './lib/tour'
import { Map, List, Heart, MessageSquare, User, Shield, Pencil, MapPin, LogOut } from 'lucide-react'
import { getInitials, getInstrumentCode, shortLocation } from './lib/musicianUtils'
import { isOnline } from './lib/presence'
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
  const { currentUser, initAuth, needsPasswordReset, musicians, selectedId, setSelectedId, activeTab, setActiveTab, showFilterPanel, isAuthReady, setActiveThreadId, unreadCount, toast, currentProfile, logout } = useStore()
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

  // Reset signup state on logout; start tour on first login for returning users
  useEffect(() => {
    if (prevUserRef.current && !currentUser) {
      setSignupDismissed(false)
      setShowOnboarding(false)
    }
    // Returning user logs in for the first time this device — show tour
    if (!prevUserRef.current && currentUser && !hasSeenTour()) {
      setTimeout(() => startTour(), 800)
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
    <div className="h-dvh flex flex-col bg-ground text-ink font-sans">
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
          <MusicianList onViewProfile={(m) => {
            if (!currentUser) { setModal('auth'); return }
            openMusician(m.id); setShowMobileDetail(true)
          }} />
        </div>


        {/* Map area: always on desktop; only on 'map' tab on mobile */}
        <div className={`flex-1 relative min-h-0 ${
          activeTab === 'map' ? 'flex' : 'hidden'
        } lg:flex`}>
          <MusicianMap />
          {/* Active filter chips overlay on mobile map view */}
          <div className="lg:hidden absolute top-0 left-0 right-0 z-[1001] bg-ground">
            <ActiveFilters />
          </div>

          {/* Mobile bottom card: shown when musician selected on map */}
          {selectedMusician && activeTab === 'map' && !showMobileDetail && (
            <div className="lg:hidden absolute bottom-0 left-0 right-0 z-[999] border-t-2 border-ink bg-ground shadow-lg" onClick={e => e.stopPropagation()}>
              <div className="grid" style={{ gridTemplateColumns: '52px 1fr auto' }}>
                {/* Instrument code block */}
                <div className="self-stretch m-2 mr-0 bg-accent text-white flex items-center justify-center text-[13px] font-extrabold leading-none flex-shrink-0">
                  {getInstrumentCode(selectedMusician.instruments)}
                </div>
                {/* Info */}
                <div className="py-2.5 px-3 min-w-0">
                  <p className="text-[16px] font-extrabold text-ink leading-tight truncate flex items-center gap-1.5">
                    {isOnline(selectedMusician.lastSeenAt) && (
                      <span className="inline-block w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                    )}
                    {selectedMusician.displayName}
                  </p>
                  <p className="text-[13px] text-neutral-700 mt-0.5 truncate">
                    {[selectedMusician.instruments.slice(0, 2).join(', '), shortLocation(selectedMusician.locationName)].filter(Boolean).join(' · ')}
                  </p>
                </div>
                {/* CTA */}
                <button
                  onClick={() => {
                    if (!currentUser) { setModal('auth'); return }
                    setShowMobileDetail(true)
                  }}
                  className="flex items-center gap-1.5 flex-shrink-0 border-l-2 border-ink bg-accent hover:bg-accent-600 text-white font-extrabold text-[13px] px-4 transition-colors"
                >
                  View →
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Mobile-only other tabs */}
        {activeTab !== 'map' && activeTab !== 'list' && (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden lg:hidden">
            {activeTab === 'me' && (() => {
              const profile = currentProfile()
              if (!currentUser || !profile) {
                return (
                  <div className="flex-1 flex flex-col items-center justify-center gap-5 px-8 text-center">
                    <div className="w-16 h-16 bg-ink flex items-center justify-center flex-shrink-0">
                      <User size={28} className="text-white" />
                    </div>
                    <div>
                      <p className="text-[20px] font-extrabold text-ink leading-tight">Not signed in</p>
                      <p className="text-[13px] text-neutral-600 mt-1.5 leading-relaxed">Sign in to create a profile and connect with musicians near you.</p>
                    </div>
                    <button
                      onClick={() => setModal('auth')}
                      className="h-12 px-8 bg-accent hover:bg-accent-600 text-white font-extrabold text-sm transition-colors"
                    >
                      Sign in →
                    </button>
                  </div>
                )
              }
              const initials = getInitials(profile.displayName)
              const code = getInstrumentCode(profile.instruments)
              return (
                <div className="flex-1 flex flex-col overflow-y-auto">
                  {/* Avatar */}
                  <div className="w-full h-[200px] bg-neutral-200 relative flex-shrink-0">
                    {profile.avatarUrl ? (
                      <img src={profile.avatarUrl} alt={profile.displayName} className="w-full h-full object-cover grayscale" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-ink">
                        <span className="text-[72px] font-black text-white leading-none tracking-tighter select-none">{initials}</span>
                      </div>
                    )}
                  </div>
                  {/* Accent header */}
                  <div className="bg-accent border-t-2 border-ink px-4 pt-3 pb-4 flex-shrink-0">
                    <p className="text-[11px] font-extrabold uppercase tracking-widest text-white/70 mb-1">
                      {profile.instruments.slice(0, 2).join(', ') || 'Musician'}
                    </p>
                    <h2 className="text-[32px] font-extrabold text-white leading-none tracking-tight">{profile.displayName}</h2>
                    {profile.locationName && (
                      <p className="text-[13px] font-semibold text-white/80 mt-1.5 flex items-center gap-1">
                        <MapPin size={11} />
                        {shortLocation(profile.locationName)}
                      </p>
                    )}
                  </div>
                  {/* Info row */}
                  {(profile.genres.length > 0 || profile.level) && (
                    <div className="px-4 py-3 border-b-2 border-ink flex-shrink-0">
                      <p className="text-[12px] text-neutral-600 leading-snug">
                        {[profile.genres.slice(0, 3).join(', '), profile.level].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                  )}
                  {/* Actions */}
                  <div className="px-4 pt-5 flex flex-col gap-3">
                    <button
                      onClick={showProfile}
                      className="w-full h-12 bg-accent hover:bg-accent-600 text-white font-extrabold text-sm flex items-center justify-between px-4 transition-colors"
                    >
                      <span className="flex items-center gap-2"><Pencil size={14} /> Edit My Profile</span>
                      <span>→</span>
                    </button>
                    {isAdmin && (
                      <button
                        onClick={() => setModal('admin')}
                        className="w-full h-12 border-2 border-ink hover:bg-accent-100 text-ink font-extrabold text-sm flex items-center gap-2 px-4 transition-colors"
                      >
                        <Shield size={14} />
                        Admin Panel
                      </button>
                    )}
                  </div>
                  {/* Sign out */}
                  <div className="px-4 pt-6 pb-4">
                    <button
                      onClick={logout}
                      className="flex items-center gap-1.5 text-[12px] font-semibold text-neutral-400 hover:text-accent-700 transition-colors"
                    >
                      <LogOut size={12} />
                      Sign out
                    </button>
                  </div>
                </div>
              )
            })()}
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
          <div className="hidden lg:flex absolute inset-0 z-[1050] bg-ground">
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
          <div className="hidden lg:flex absolute inset-0 z-[1050] bg-ground">
            <InboxTab
              onViewProfile={(id) => { setSelectedId(id); setActiveTab('map') }}
            />
          </div>
        )}

        {/* Desktop: detail panel */}
        {selectedId && selectedMusician && (
          <div className="hidden lg:flex w-[420px] flex-shrink-0 flex-col border-l-2 border-ink overflow-y-auto large-text-zoom">
            {currentUser ? (
              <MusicianDetail
                musician={selectedMusician}
                onClose={() => setSelectedId(null)}
                onEditProfile={showProfile}
                onOpenMessages={openMessages}
              />
            ) : (
              <div className="flex flex-col h-full">
                <div className="flex-1 flex flex-col items-center justify-center gap-6 px-8 text-center">
                  <p className="text-[22px] font-extrabold text-ink leading-tight">{selectedMusician.displayName}</p>
                  <p className="text-sm text-neutral-600">Sign in to view full profiles and connect with musicians.</p>
                  <button
                    onClick={() => setModal('auth')}
                    className="h-12 px-6 bg-accent hover:bg-accent-600 text-white font-extrabold text-sm transition-colors"
                  >
                    Sign in to view →
                  </button>
                </div>
              </div>
            )}
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
      <nav className="lg:hidden flex-shrink-0 flex border-t-2 border-ink h-14 pb-[env(safe-area-inset-bottom)]">
        {BOTTOM_TABS.map(tab => (
          <button
            key={tab.id}
            data-tour={`nav-${tab.id}`}
            onClick={() => {
              if (tab.id === 'me') { setActiveTab('me'); return }
              setActiveTab(tab.id)
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
          onComplete={() => { setShowOnboarding(false); setTimeout(() => startTour(), 800) }}
          onBack={() => { setShowOnboarding(false); setSignupDismissed(true) }}
        />
      )}

      {/* Mobile filter panel — fixed overlay at root level so it renders above Leaflet's GPU layers */}
      {showFilterPanel && (
        <div className="lg:hidden fixed inset-0 z-[1200] flex flex-col">
          <FilterPanel isMobile />
        </div>
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
