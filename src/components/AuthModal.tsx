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
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b-2 border-ink">
          <h2 className="text-xl font-extrabold text-ink">
            {tab === 'login' ? 'Welcome back' : tab === 'register' ? 'Create account' : 'Reset Password'}
          </h2>
          <button onClick={onClose} className="text-neutral-500 hover:text-ink text-2xl leading-none">×</button>
        </div>

        {tab !== 'forgot' && (
          <div className="flex border-b-2 border-ink mx-6">
            {(['login', 'register'] as const).map(t => (
              <button
                key={t}
                onClick={() => switchTab(t)}
                className={`flex-1 pb-2 text-sm font-bold capitalize transition-colors ${
                  tab === t
                    ? 'text-accent-700 border-b-2 border-accent -mb-px'
                    : 'text-neutral-500 hover:text-ink'
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
              <label className="block text-xs font-extrabold uppercase tracking-widest text-neutral-700 mb-1">Display Name</label>
              <input
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="Your name or artist name"
                className="w-full h-12 bg-white border-2 border-ink px-3 text-sm focus:outline-none"
                required
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-extrabold uppercase tracking-widest text-neutral-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full h-12 bg-white border-2 border-ink px-3 text-sm focus:outline-none"
              required
            />
          </div>

          {tab !== 'forgot' && (
            <div>
              <label className="block text-xs font-extrabold uppercase tracking-widest text-neutral-700 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full h-12 bg-white border-2 border-ink px-3 text-sm focus:outline-none"
                required
              />
            </div>
          )}

          {tab === 'login' && (
            <div className="flex justify-end -mt-2">
              <button
                type="button"
                onClick={() => { setTab('forgot'); setError(''); setResetSent(false) }}
                className="text-xs text-accent-700 hover:text-accent-600"
              >
                Forgot password?
              </button>
            </div>
          )}

          {error && (
            <p className="text-sm text-accent-700 bg-accent-100 border-2 border-accent px-3 py-2">{error}</p>
          )}

          {resetSent ? (
            <div className="border-2 border-ink px-3 py-3 space-y-3">
              <p className="text-sm font-bold text-ink">Check your email!</p>
              <p className="text-xs text-neutral-700">A password reset link has been sent to {email}.</p>
              <button
                type="button"
                onClick={() => switchTab('login')}
                className="text-xs text-accent-700 hover:underline"
              >
                Back to Sign In
              </button>
            </div>
          ) : (
            <>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-between h-[52px] bg-accent hover:bg-accent-600 disabled:opacity-60 text-white font-bold px-4 text-sm transition-colors"
              >
                <span>
                  {loading
                    ? 'Please wait…'
                    : tab === 'login'
                      ? 'Sign In'
                      : tab === 'register'
                        ? 'Create Account'
                        : 'Send Reset Link'}
                </span>
                <span>→</span>
              </button>

              {tab === 'forgot' && (
                <button
                  type="button"
                  onClick={() => switchTab('login')}
                  className="w-full text-sm text-neutral-500 hover:text-ink"
                >
                  Back to Sign In
                </button>
              )}
            </>
          )}

          {tab === 'register' && (
            <p className="text-xs text-neutral-500 text-center">
              By registering you agree to display your location publicly to other musicians.
            </p>
          )}
        </form>
      </div>
    </div>
  )
}
