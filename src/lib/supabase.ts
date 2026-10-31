import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

// Read before createClient, which consumes and clears the URL hash. The "confirm your
// email" link lands back here with `#access_token=…&type=signup`.
export const landedFromSignupLink =
  new URLSearchParams(window.location.hash.slice(1)).get('type') === 'signup'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
