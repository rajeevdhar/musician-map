import { useState } from 'react'
import { useStore } from '../store'

interface Props {
  onSignedUp: () => void
  onLogin: () => void
  onSkip: () => void
}

export default function SignupScreen({ onSignedUp, onLogin, onSkip }: Props) {
  const { register } = useStore()
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password.length < 6) { setError('Password must be at least 6 characters'); return }
    setLoading(true)
    const { ok, error: err } = await register(email, password, displayName.trim())
    setLoading(false)
    if (!ok) { setError(err ?? 'Sign-up failed'); return }
    onSignedUp()
  }

  const Form = ({ gap = 'gap-3.5', titleSize = 'text-[40px]' }: { gap?: string; titleSize?: string }) => (
    <form onSubmit={handleSubmit} className={`flex flex-col ${gap}`}>
      <h2 className={`${titleSize} font-extrabold text-ink leading-none`}>Create your account</h2>
      <input
        type="text"
        placeholder="Your name"
        value={displayName}
        onChange={e => setDisplayName(e.target.value)}
        required
        className="h-12 bg-white border-2 border-ink px-3 text-[15px] text-ink placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
      />
      <input
        type="email"
        placeholder="Email address"
        value={email}
        onChange={e => setEmail(e.target.value)}
        required
        className="h-12 bg-white border-2 border-ink px-3 text-[15px] text-ink placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
      />
      <input
        type="password"
        placeholder="Password (6+ chars)"
        value={password}
        onChange={e => setPassword(e.target.value)}
        required
        minLength={6}
        className="h-12 bg-white border-2 border-ink px-3 text-[15px] text-ink placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
      />
      {error && <p className="text-sm text-accent-700 font-semibold">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="h-[52px] bg-accent hover:bg-accent-600 disabled:opacity-60 text-white font-extrabold text-[15px] flex items-center justify-between px-4 transition-colors"
      >
        <span>{loading ? 'Creating account…' : 'Create account'}</span>
        <span>→</span>
      </button>
      <div className="grid grid-cols-2 gap-3">
        <button type="button" className="h-[52px] border-2 border-ink text-[15px] font-extrabold flex items-center justify-between px-4 hover:bg-accent-100 transition-colors text-ink">
          <span>Apple</span><span>→</span>
        </button>
        <button type="button" className="h-[52px] border-2 border-ink text-[15px] font-extrabold flex items-center justify-between px-4 hover:bg-accent-100 transition-colors text-ink">
          <span>Google</span><span>→</span>
        </button>
      </div>
      <p className="text-[13px] text-neutral-700">
        Have an account?{' '}
        <button type="button" onClick={onLogin} className="font-extrabold text-ink underline underline-offset-2 hover:text-accent-700">
          Log in
        </button>
      </p>
      <button type="button" onClick={onSkip} className="text-[13px] text-neutral-500 hover:text-neutral-700 underline underline-offset-2 text-left">
        Browse map without signing up →
      </button>
    </form>
  )

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
              Find the musicians around you.
            </h1>
            <p className="text-white/80 text-[18px] font-semibold leading-[1.4] max-w-[440px] mt-6">
              Put yourself on the map. Find a drummer, a band or a jam three blocks away.
            </p>
          </div>
        </div>

        {/* Right: form */}
        <div className="border-l-2 border-ink flex items-center justify-center p-10">
          <div className="w-full">
            <Form />
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
            Find the musicians around you.
          </h1>
        </div>
        <div className="border-t-2 border-ink p-4 pb-8">
          <Form gap="gap-3" titleSize="text-[28px]" />
        </div>
      </div>
    </div>
  )
}
