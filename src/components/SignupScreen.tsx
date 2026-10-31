import { useState } from 'react'
import { useStore } from '../store'
import GoogleButton, { OrDivider, googleSignInEnabled } from './GoogleButton'

interface FormProps {
  gap?: string
  titleSize?: string
  displayName: string
  onDisplayName: (v: string) => void
  email: string
  onEmail: (v: string) => void
  password: string
  onPassword: (v: string) => void
  ageConfirmed: boolean
  onToggleAge: () => void
  error: string
  loading: boolean
  onSubmit: (e: React.FormEvent) => void
  onGoogle: (idToken: string, nonce: string) => void
  onLogin: () => void
  onSkip: () => void
  sentTo: string | null
  onChangeEmail: () => void
}

function SignupForm({ gap = 'gap-3.5', titleSize = 'text-[40px]', displayName, onDisplayName, email, onEmail, password, onPassword, ageConfirmed, onToggleAge, error, loading, onSubmit, onGoogle, onLogin, onSkip, sentTo, onChangeEmail }: FormProps) {
  if (sentTo) return (
    <div className={`flex flex-col ${gap}`}>
      <h2 className={`${titleSize} font-extrabold text-ink leading-none`}>Check your email</h2>
      <p className="text-[15px] text-neutral-700 leading-snug">
        We sent a confirmation link to <strong className="text-ink break-all">{sentTo}</strong>. Click it to finish creating your account, then you can add yourself to the map.
      </p>
      <p className="text-[13px] text-neutral-500">Not there? Check your spam folder.</p>
      <button type="button" onClick={onChangeEmail} className="text-[13px] text-neutral-500 hover:text-neutral-700 underline underline-offset-2 text-left">
        Use a different email
      </button>
      <button type="button" onClick={onSkip} className="text-[13px] text-neutral-500 hover:text-neutral-700 underline underline-offset-2 text-left">
        Browse map while you wait →
      </button>
    </div>
  )

  return (
    <form onSubmit={onSubmit} className={`flex flex-col ${gap}`}>
      <h2 className={`${titleSize} font-extrabold text-ink leading-none`}>Join the map</h2>
      <input
        type="text"
        placeholder="Your name"
        value={displayName}
        onChange={e => onDisplayName(e.target.value)}
        required
        className="h-12 bg-white border-2 border-ink px-3 text-[15px] text-ink placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
      />
      <input
        type="email"
        placeholder="Email address"
        value={email}
        onChange={e => onEmail(e.target.value)}
        required
        className="h-12 bg-white border-2 border-ink px-3 text-[15px] text-ink placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
      />
      <input
        type="password"
        placeholder="Password (6+ chars)"
        value={password}
        onChange={e => onPassword(e.target.value)}
        required
        minLength={6}
        className="h-12 bg-white border-2 border-ink px-3 text-[15px] text-ink placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
      />
      <button type="button" role="checkbox" aria-checked={ageConfirmed} onClick={onToggleAge} className="flex items-start gap-3 text-left">
        <span className={`mt-0.5 w-5 h-5 flex-shrink-0 border-2 border-ink flex items-center justify-center transition-colors ${ageConfirmed ? 'bg-ink' : 'hover:bg-accent-100'}`}>
          {ageConfirmed && (
            <svg width="11" height="9" viewBox="0 0 11 9" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M1 4L4 7.5L10 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </span>
        <span className="text-[13px] text-neutral-700 leading-snug">
          I confirm that I am <strong className="text-ink">16 years of age or older</strong>
        </span>
      </button>
      {error && <p className="text-sm text-accent-700 font-semibold">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="h-[52px] bg-accent hover:bg-accent-600 disabled:opacity-60 text-white font-extrabold text-[15px] flex items-center justify-between px-4 transition-colors"
      >
        <span>{loading ? 'Creating account…' : 'Create account'}</span>
        <span>→</span>
      </button>
      {googleSignInEnabled && (
        <>
          <OrDivider />
          <GoogleButton onCredential={onGoogle} disabled={loading} />
        </>
      )}
      <p className="text-[13px] text-neutral-700">
        Have an account?{' '}
        <button type="button" onClick={onLogin} className="font-extrabold text-ink underline underline-offset-2 hover:text-accent-700">
          Log in
        </button>
      </p>
      <button type="button" onClick={onSkip} className="text-[13px] text-neutral-500 hover:text-neutral-700 underline underline-offset-2 text-left">
        Browse map without signing up →
      </button>
      <a href="/privacy.html" target="_blank" rel="noopener" className="text-[13px] text-neutral-500 hover:text-neutral-700 underline underline-offset-2">
        Privacy policy
      </a>
    </form>
  )
}

interface Props {
  onSignedUp: () => void
  onLogin: () => void
  onSkip: () => void
}

export default function SignupScreen({ onSignedUp, onLogin, onSkip }: Props) {
  const { register, loginWithGoogle } = useStore()
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [ageConfirmed, setAgeConfirmed] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!ageConfirmed) { setError('You must confirm you are 16 or older to register'); return }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return }
    setLoading(true)
    const { ok, needsConfirmation, error: err } = await register(email, password, displayName.trim())
    setLoading(false)
    if (!ok) { setError(err ?? 'Sign-up failed'); return }
    if (needsConfirmation) { setSentTo(email); return }
    onSignedUp()
  }

  // Signing in hides this screen; App opens onboarding (which asks 16+) if the account has no profile yet
  const handleGoogle = async (idToken: string, nonce: string) => {
    setError('')
    setLoading(true)
    const { ok, error: err } = await loginWithGoogle(idToken, nonce)
    setLoading(false)
    if (!ok) setError(err ?? 'Google sign-in failed')
  }

  const formProps = { displayName, onDisplayName: setDisplayName, email, onEmail: setEmail, password, onPassword: setPassword, ageConfirmed, onToggleAge: () => setAgeConfirmed(v => !v), error, loading, onSubmit: handleSubmit, onGoogle: handleGoogle, onLogin, onSkip, sentTo, onChangeEmail: () => setSentTo(null) }

  return (
    <div className="fixed inset-0 z-[2000] bg-ground">
      {/* ── Desktop ── */}
      <div className="hidden lg:grid h-full" style={{ gridTemplateColumns: '1fr 520px' }}>
        {/* Left: accent hero */}
        <div className="bg-accent flex flex-col" style={{ padding: '28px 40px 48px' }}>
          <span className="text-white text-[18px] font-extrabold tracking-tight flex-shrink-0">MUSICIANMAPPER.</span>
          <div className="mt-auto">
            <h1
              className="text-white text-[96px] font-extrabold leading-[0.88] tracking-[-0.04em] max-w-[640px]"
              style={{ textWrap: 'balance' } as React.CSSProperties}
            >
              Band together!
            </h1>
            <p className="text-white/80 text-[18px] font-semibold leading-[1.4] max-w-[440px] mt-6">
              Drop a pin, browse musicians near you, and find your next bandmate or collaborator.
            </p>
          </div>
        </div>

        {/* Right: form */}
        <div className="border-l-2 border-ink flex items-center justify-center p-10">
          <div className="w-full">
            <SignupForm {...formProps} />
          </div>
        </div>
      </div>

      {/* ── Mobile ── */}
      <div className="lg:hidden flex flex-col h-full overflow-y-auto">
        <div className="bg-accent px-4 pt-6 pb-10 flex-shrink-0">
          <span className="text-white text-[15px] font-extrabold tracking-tight">MUSICIANMAPPER.</span>
          <h1
            className="text-white text-[56px] font-extrabold leading-[0.9] tracking-[-0.03em] mt-4"
            style={{ textWrap: 'balance' } as React.CSSProperties}
          >
            Band together!
          </h1>
        </div>
        <div className="border-t-2 border-ink p-4 pb-8">
          <SignupForm {...formProps} gap="gap-3" titleSize="text-[28px]" />
        </div>
      </div>
    </div>
  )
}
