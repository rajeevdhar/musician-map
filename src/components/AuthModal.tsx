import { useState } from 'react'
import { useStore } from '../store'
import { supabase } from '../lib/supabase'

interface Props {
  onClose: () => void
}

export default function AuthModal({ onClose }: Props) {
  const [tab, setTab] = useState<'login' | 'register' | 'forgot'>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [ageConfirmed, setAgeConfirmed] = useState(false)
  const { login, register } = useStore()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (tab === 'register') {
      if (!ageConfirmed) { setError('You must confirm you are 16 or older to register'); setLoading(false); return }
      if (password.length < 6) { setError('Password must be at least 6 characters'); setLoading(false); return }
      const result = await register(email, password, name.trim())
      if (result.ok) onClose()
      else setError(result.error ?? 'Sign-up failed')
    } else if (tab === 'login') {
      const result = await login(email, password)
      if (result.ok) onClose()
      else setError(result.error ?? 'Login failed')
    } else {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      })
      if (resetError) setError(resetError.message)
      else setResetSent(true)
    }

    setLoading(false)
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

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {tab === 'register' && (
            <div>
              <label className="block text-xs font-extrabold uppercase tracking-widest text-neutral-700 mb-1">Your name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Your name"
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

          {(tab === 'login' || tab === 'register') && (
            <div>
              <label className="block text-xs font-extrabold uppercase tracking-widest text-neutral-700 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={tab === 'register' ? '6+ characters' : '••••••••'}
                className="w-full h-12 bg-white border-2 border-ink px-3 text-sm focus:outline-none"
                required
              />
              {tab === 'login' && (
                <div className="flex justify-end mt-1">
                  <button
                    type="button"
                    onClick={() => { setTab('forgot'); setError(''); setResetSent(false) }}
                    className="text-xs text-accent-700 hover:text-accent-600"
                  >
                    Forgot password?
                  </button>
                </div>
              )}
            </div>
          )}

          {tab === 'register' && (
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <div
                onClick={() => setAgeConfirmed(v => !v)}
                className={`mt-0.5 w-5 h-5 flex-shrink-0 border-2 flex items-center justify-center transition-colors ${
                  ageConfirmed ? 'bg-ink border-ink' : 'border-ink hover:bg-accent-100'
                }`}
              >
                {ageConfirmed && (
                  <svg width="11" height="9" viewBox="0 0 11 9" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M1 4L4 7.5L10 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>
              <span className="text-[13px] text-neutral-700 leading-snug" onClick={() => setAgeConfirmed(v => !v)}>
                I confirm that I am <strong className="text-ink">16 years of age or older</strong>
              </span>
            </label>
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
                onClick={() => { setTab('login'); setResetSent(false) }}
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
                <span>{loading ? 'Please wait…' : tab === 'login' ? 'Sign In' : tab === 'register' ? 'Create account' : 'Send Reset Link'}</span>
                <span>→</span>
              </button>

              {tab === 'login' && (
                <p className="text-sm text-center text-neutral-500">
                  No account?{' '}
                  <button
                    type="button"
                    onClick={() => { setTab('register'); setError(''); setAgeConfirmed(false) }}
                    className="font-extrabold text-ink hover:text-accent transition-colors"
                  >
                    Register →
                  </button>
                </p>
              )}

              {tab === 'register' && (
                <p className="text-sm text-center text-neutral-500">
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => { setTab('login'); setError('') }}
                    className="font-extrabold text-ink hover:text-accent transition-colors"
                  >
                    Sign in →
                  </button>
                </p>
              )}

              {tab === 'forgot' && (
                <button
                  type="button"
                  onClick={() => { setTab('login'); setError('') }}
                  className="w-full text-sm text-neutral-500 hover:text-ink"
                >
                  Back to Sign In
                </button>
              )}
            </>
          )}
        </form>
      </div>
    </div>
  )
}
