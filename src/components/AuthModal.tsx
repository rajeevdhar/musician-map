import { useState } from 'react'
import { useStore } from '../store'
import { supabase } from '../lib/supabase'

interface Props {
  onClose: () => void
  onRegistered: () => void
}

export default function AuthModal({ onClose, onRegistered }: Props) {
  const [tab, setTab] = useState<'login' | 'register' | 'forgot'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const { login, register } = useStore()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (tab === 'login') {
      const result = await login(email, password)
      if (result.ok) { onClose() }
      else setError(result.error ?? 'Login failed')
    } else if (tab === 'register') {
      if (!displayName.trim()) { setError('Display name required'); setLoading(false); return }
      if (password.length < 6) { setError('Password must be at least 6 characters'); setLoading(false); return }
      const result = await register(email, password, displayName.trim())
      if (result.ok) { onRegistered() }
      else setError(result.error ?? 'Registration failed')
    } else {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      })
      if (resetError) setError(resetError.message)
      else setResetSent(true)
    }

    setLoading(false)
  }

  const switchTab = (t: 'login' | 'register') => {
    setTab(t); setError(''); setResetSent(false)
  }

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-box">
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <h2 className="text-xl font-bold text-gray-900">
            {tab === 'login' ? 'Welcome back 🎵' : tab === 'register' ? 'Join MusicianMap 🎸' : 'Reset Password'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        {tab !== 'forgot' && (
          <div className="flex border-b border-gray-200 mx-6">
            {(['login', 'register'] as const).map(t => (
              <button
                key={t}
                onClick={() => switchTab(t)}
                className={`flex-1 pb-2 text-sm font-medium capitalize transition-colors ${
                  tab === t
                    ? 'text-indigo-600 border-b-2 border-indigo-600 -mb-px'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {t === 'login' ? 'Sign In' : 'Register'}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {tab === 'register' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Display Name</label>
              <input
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="Your name or artist name"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            />
          </div>

          {tab !== 'forgot' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>
          )}

          {tab === 'login' && (
            <div className="flex justify-end -mt-2">
              <button
                type="button"
                onClick={() => { setTab('forgot'); setError(''); setResetSent(false) }}
                className="text-xs text-indigo-500 hover:text-indigo-700"
              >
                Forgot password?
              </button>
            </div>
          )}

          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
          )}

          {resetSent ? (
            <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-3 space-y-3">
              <p className="text-sm text-green-700 font-medium">Check your email!</p>
              <p className="text-xs text-green-600">A password reset link has been sent to {email}.</p>
              <button
                type="button"
                onClick={() => switchTab('login')}
                className="text-xs text-indigo-600 hover:underline"
              >
                Back to Sign In
              </button>
            </div>
          ) : (
            <>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-medium py-2.5 rounded-lg transition-colors"
              >
                {loading
                  ? 'Please wait…'
                  : tab === 'login'
                    ? 'Sign In'
                    : tab === 'register'
                      ? 'Create Account'
                      : 'Send Reset Link'}
              </button>

              {tab === 'forgot' && (
                <button
                  type="button"
                  onClick={() => switchTab('login')}
                  className="w-full text-sm text-gray-500 hover:text-gray-700"
                >
                  Back to Sign In
                </button>
              )}
            </>
          )}

          {tab === 'register' && (
            <p className="text-xs text-gray-500 text-center">
              By registering you agree to display your location publicly to other musicians.
            </p>
          )}
        </form>
      </div>
    </div>
  )
}
