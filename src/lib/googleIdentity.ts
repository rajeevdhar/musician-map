// Google Identity Services: Google's own button and popup, so Google's consent
// screen names this site instead of the Supabase project URL. The ID token it
// returns is exchanged for a Supabase session with signInWithIdToken (store.ts).

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined

export const googleSignInEnabled = !!CLIENT_ID

interface GsiButtonOptions {
  theme?: 'outline' | 'filled_blue' | 'filled_black'
  size?: 'large' | 'medium' | 'small'
  text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin'
  shape?: 'rectangular' | 'pill'
  logo_alignment?: 'left' | 'center'
  width?: number
  click_listener?: () => void
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: { client_id: string; nonce: string; callback: (r: { credential: string }) => void }) => void
          renderButton: (el: HTMLElement, options: GsiButtonOptions) => void
        }
      }
    }
  }
}

type CredentialHandler = (idToken: string, nonce: string) => void

// GIS has one global callback, but a button can be on screen twice (signup screen
// behind the auth modal), so each button claims the callback when clicked.
let activeHandler: CredentialHandler | null = null
let ready: Promise<void> | null = null

async function sha256Hex(text: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('')
}

function loadGis(): Promise<void> {
  if (ready) return ready
  ready = (async () => {
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script')
      script.src = 'https://accounts.google.com/gsi/client'
      script.async = true
      script.onload = () => resolve()
      script.onerror = () => reject(new Error('Could not load Google sign-in'))
      document.head.appendChild(script)
    })
    // Google embeds the hashed nonce in the ID token; Supabase checks it against the raw one
    const nonce = crypto.randomUUID()
    window.google!.accounts.id.initialize({
      client_id: CLIENT_ID!,
      nonce: await sha256Hex(nonce),
      callback: ({ credential }) => activeHandler?.(credential, nonce),
    })
  })()
  ready.catch(() => { ready = null })
  return ready
}

export async function renderGoogleButton(el: HTMLElement, width: number, onCredential: CredentialHandler) {
  await loadGis()
  window.google!.accounts.id.renderButton(el, {
    theme: 'outline',
    size: 'large',
    text: 'continue_with',
    shape: 'rectangular',
    logo_alignment: 'center',
    // GIS takes a fixed pixel width between 200 and 400
    width: Math.max(200, Math.min(400, width)),
    click_listener: () => { activeHandler = onCredential },
  })
}
