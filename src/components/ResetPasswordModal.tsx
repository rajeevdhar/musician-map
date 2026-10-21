import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useStore } from '../store'

interface Props {
  onClose: () => void
}

export default function ResetPasswordModal({ onClose }: Props) {
  const { fetchMusicians } = useStore()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password.length < 6) { setError('Password must be at least 6 characters'); return }
    if (password !== confirm) { setError('Passwords do not match'); return }

    setSaving(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setSaving(false)

    if (updateError) { setError(updateError.message); return }

    setDone(true)
    await fetchMusicians()
  }

  if (done) {
    return (
      <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
        <div className="modal-box max-w-sm">
          <div className="p-8 text-center space-y-4">
            <h2 className="text-xl font-extrabold text-ink">Password updated!</h2>
            <p className="text-sm text-neutral-700">You're now signed in. You can close this.</p>
            <button
              onClick={onClose}
              className="flex items-center justify-between w-full h-[52px] bg-accent hover:bg-accent-600 text-white font-bold px-4 text-sm"
            >
              <span>Done</span>
              <span>→</span>
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-box max-w-sm">
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b-2 border-ink">
          <h2 className="text-xl font-extrabold text-ink">Set New Password</h2>
          <button onClick={onClose} className="text-neutral-500 hover:text-ink text-2xl leading-none">×</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-extrabold uppercase tracking-widest text-neutral-700 mb-1">New Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoFocus
              className="w-full h-12 bg-white border-2 border-ink px-3 text-sm focus:outline-none"
              placeholder="At least 6 characters"
            />
          </div>

          <div>
            <label className="block text-xs font-extrabold uppercase tracking-widest text-neutral-700 mb-1">Confirm Password</label>
            <input
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              className="w-full h-12 bg-white border-2 border-ink px-3 text-sm focus:outline-none"
              placeholder="Repeat your new password"
            />
          </div>

          {error && (
            <p className="text-sm text-accent-700 bg-accent-100 border-2 border-accent px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="flex items-center justify-between w-full h-[52px] bg-accent hover:bg-accent-600 disabled:opacity-60 text-white font-bold px-4 text-sm transition-colors"
          >
            <span>{saving ? 'Saving…' : 'Update Password'}</span>
            <span>→</span>
          </button>
        </form>
      </div>
    </div>
  )
}
