// Shared online-status rules. "Online" = heartbeat seen within the last 5 minutes.
export const ONLINE_WINDOW_MS = 5 * 60 * 1000

export function isOnline(lastSeenAt?: string, now: number = Date.now()): boolean {
  if (!lastSeenAt) return false
  const t = new Date(lastSeenAt).getTime()
  return !isNaN(t) && now - t < ONLINE_WINDOW_MS
}
