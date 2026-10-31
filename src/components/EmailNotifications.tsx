import { useEffect, useState } from 'react'
import { Mail } from 'lucide-react'
import { useStore } from '../store'
import { supabase } from '../lib/supabase'

// On/off switch for email notifications (new messages, contact requests, accepted requests).
// Saved straight away to notification_settings (owner-only); no row means emails are on.
export default function EmailNotifications() {
  const { currentUser, showToast } = useStore()
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!currentUser) return
    supabase
      .from('notification_settings')
      .select('email_enabled')
      .eq('id', currentUser.id)
      .maybeSingle()
      .then(({ data }) => setEnabled(data?.email_enabled ?? true))
  }, [currentUser])

  const toggle = async () => {
    if (!currentUser || enabled === null || saving) return
    const next = !enabled
    setSaving(true)
    setEnabled(next)
    const { error } = await supabase
      .from('notification_settings')
      .upsert({ id: currentUser.id, email_enabled: next, updated_at: new Date().toISOString() })
    setSaving(false)
    if (error) {
      setEnabled(!next)
      showToast('Could not save email setting')
    }
  }

  return (
    <div className="border-t-2 border-ink px-4 lg:px-6 py-4">
      <button
        type="button"
        role="checkbox"
        aria-checked={!!enabled}
        disabled={enabled === null || saving}
        onClick={toggle}
        className="flex items-start gap-3 py-2 px-4 text-left disabled:opacity-60"
      >
        <span className={`mt-0.5 w-5 h-5 flex-shrink-0 border-2 border-ink flex items-center justify-center transition-colors ${enabled ? 'bg-ink' : 'hover:bg-accent-100'}`}>
          {enabled && (
            <svg width="11" height="9" viewBox="0 0 11 9" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M1 4L4 7.5L10 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </span>
        <span className="text-[13px] text-ink leading-snug">
          <span className="flex items-center gap-2"><Mail size={14} />Email me about new messages and contact requests</span>
          <span className="block text-[12px] text-neutral-500 mt-0.5">Sent to your account email, at most one per person every 30 minutes.</span>
        </span>
      </button>
    </div>
  )
}
