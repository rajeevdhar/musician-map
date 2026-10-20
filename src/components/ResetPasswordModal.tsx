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
            <div className="text-4xl">🎉</div>
            <h2 className="text-xl font-bold text-gray-900">Password updated!</h2>
            <p className="text-sm text-gray-500">You're now signed in. You can close this.</p>
            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-box max-w-sm">
        <div className="sticky top-0 bg-white flex items-center justify-between px-6 pt-5 pb-3 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-900">Set New Password</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoFocus
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="At least 6 characters"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
            <input
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Repeat your new password"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-medium transition-colors"
          >
            {saving ? 'Saving…' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  )
}
