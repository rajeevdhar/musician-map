import { useEffect, useState } from 'react'
import { useStore } from './store'
import type { Musician } from './types'
import Header from './components/Header'
import MusicianMap from './components/MusicianMap'
import AuthModal from './components/AuthModal'
import ProfileModal from './components/ProfileModal'
import MusicianDetail from './components/MusicianDetail'
import AdminPanel from './components/AdminPanel'
import ResetPasswordModal from './components/ResetPasswordModal'

type Modal = 'auth' | 'profile' | 'musician' | 'admin' | null

export default function App() {
  const { currentUser, initAuth, needsPasswordReset } = useStore()
  const [modal, setModal] = useState<Modal>(null)
  const [selectedMusician, setSelectedMusician] = useState<Musician | null>(null)

  // Restore Supabase session on first render
  useEffect(() => { initAuth() }, []) // eslint-disable-line

  const adminEmail = import.meta.env.VITE_ADMIN_EMAIL
  const isAdmin = !!currentUser && currentUser.email === adminEmail

  const openMusician = (m: Musician) => {
    setSelectedMusician(m)
    setModal('musician')
  }

  const handleRegistered = () => setModal('profile')

  return (
    <div className="relative w-full h-full overflow-hidden">
      <MusicianMap onMusicianClick={openMusician} />

      <Header
        onShowAuth={() => setModal('auth')}
        onShowProfile={() => {
          if (!currentUser) { setModal('auth'); return }
          setModal('profile')
        }}
        onShowAdmin={() => setModal('admin')}
        isAdmin={isAdmin}
      />

      {modal === 'auth' && (
        <AuthModal onClose={() => setModal(null)} onRegistered={handleRegistered} />
      )}

      {modal === 'profile' && currentUser && (
        <ProfileModal onClose={() => setModal(null)} />
      )}

      {modal === 'musician' && selectedMusician && (
        <MusicianDetail
          musician={selectedMusician}
          onClose={() => { setModal(null); setSelectedMusician(null) }}
          onEditProfile={currentUser ? () => setModal('profile') : undefined}
        />
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
