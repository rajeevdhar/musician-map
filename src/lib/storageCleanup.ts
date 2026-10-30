import { supabase } from './supabase'

const USER_BUCKETS = ['avatars', 'musician-audio']

function fileName(url: string): string {
  try { return new URL(url).pathname.split('/').pop() ?? '' } catch { return '' }
}

// Profile media lives at <bucket>/<userId>/<file> in public buckets. Deletes every
// file in the user's folders except those still referenced by `keepUrls`, so
// uploads from a cancelled edit (or replaced photos/clips) don't stay public.
export async function removeOwnFiles(userId: string, keepUrls: (string | undefined)[] = []) {
  const keep = new Set(keepUrls.filter((u): u is string => !!u).map(fileName))
  for (const bucket of USER_BUCKETS) {
    const { data } = await supabase.storage.from(bucket).list(userId)
    const stale = (data ?? []).map(f => f.name).filter(n => !keep.has(n))
    if (stale.length) await supabase.storage.from(bucket).remove(stale.map(n => `${userId}/${n}`))
  }
}
