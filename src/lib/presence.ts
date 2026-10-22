// Shared online-status rules. "Online" = heartbeat seen within the last 5 minutes.
export const ONLINE_WINDOW_MS = 5 * 60 * 1000

export function isOnline(lastSeenAt?: string, now: number = Date.now()): boolean {
  if (!lastSeenAt) return false
  const t = new Date(lastSeenAt).getTime()
  return !isNaN(t) && now - t < ONLINE_WINDOW_MS
}

// Returns a short human label for when someone was last seen, or null if unknown.
// Callers should check isOnline first — this is for the offline case.
export function presenceText(lastSeenAt?: string, now: number = Date.now()): string | null {
  if (!lastSeenAt) return null
  const t = new Date(lastSeenAt).getTime()
  if (isNaN(t)) return null
  const diffMs = now - t
  const mins = Math.floor(diffMs / 60_000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}
