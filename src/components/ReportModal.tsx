import { useState } from 'react'
import { supabase } from '../lib/supabase'

const REASONS: { value: string; label: string }[] = [
  { value: 'inappropriate_image', label: 'Inappropriate photo' },
  { value: 'offensive_content',   label: 'Offensive bio or content' },
  { value: 'harassment',          label: 'Harassment or threatening behaviour' },
  { value: 'spam',                label: 'Spam or advertising' },
  { value: 'fake_profile',        label: 'Fake or impersonation profile' },
  { value: 'other',               label: 'Other' },
]

interface Props {
  profileId: string
  displayName: string
  onClose: () => void
}

export default function ReportModal({ profileId, displayName, onClose }: Props) {
  const [reason, setReason] = useState('')
  const [details, setDetails] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reason) return
    setLoading(true)
    setError('')
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(`/api/report/${profileId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({ reason, details }),
    })
    const json = await res.json()
    setLoading(false)
    if (!res.ok) {
      setError(json.error === 'Already reported' ? "You've already reported this profile." : (json.error ?? 'Something went wrong'))
      return
    }
    setDone(true)
  }

  return (
    <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-box" style={{ maxWidth: '460px' }}>
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b-2 border-ink">
          <h2 className="text-xl font-extrabold text-ink">Report profile</h2>
          <button onClick={onClose} className="text-neutral-500 hover:text-ink text-2xl leading-none">×</button>
        </div>

        {done ? (
          <div className="p-6 space-y-4">
            <p className="text-sm font-bold text-ink">Thanks for letting us know.</p>
            <p className="text-sm text-neutral-600">
              We'll review <span className="font-semibold">{displayName}</span>'s profile and take action if it violates our standards. Reports are anonymous.
            </p>
            <button
              onClick={onClose}
              className="w-full h-11 bg-ink hover:bg-neutral-800 text-white font-extrabold text-sm transition-colors"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <p className="text-sm text-neutral-600">
              Reporting <span className="font-semibold text-ink">{displayName}</span>. Select the reason that best applies.
            </p>

            <div className="space-y-2">
              {REASONS.map(r => (
                <label key={r.value} className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="radio"
                    name="reason"
                    value={r.value}
                    checked={reason === r.value}
                    onChange={() => setReason(r.value)}
                    className="accent-accent w-4 h-4 flex-shrink-0"
                  />
                  <span className="text-sm text-ink group-hover:text-accent transition-colors">{r.label}</span>
                </label>
              ))}
            </div>

            {reason && (
              <div>
                <label className="block text-xs font-extrabold uppercase tracking-widest text-neutral-700 mb-1">
                  Additional details <span className="text-neutral-400 font-normal normal-case">(optional)</span>
                </label>
                <textarea
                  value={details}
                  onChange={e => setDetails(e.target.value)}
                  maxLength={500}
                  rows={3}
                  placeholder="Describe what you saw…"
                  className="w-full bg-white border-2 border-ink px-3 py-2 text-sm focus:outline-none resize-none"
                />
              </div>
            )}

            {error && (
              <p className="text-sm text-accent-700 bg-accent-100 border-2 border-accent px-3 py-2">{error}</p>
            )}

            <button
              type="submit"
              disabled={!reason || loading}
              className="w-full flex items-center justify-between h-[52px] bg-accent hover:bg-accent-600 disabled:opacity-40 text-white font-bold px-4 text-sm transition-colors"
            >
              <span>{loading ? 'Submitting…' : 'Submit report'}</span>
              <span>→</span>
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
