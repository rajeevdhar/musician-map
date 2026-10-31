import { useEffect, useRef, useState } from 'react'
import { googleSignInEnabled, renderGoogleButton } from '../lib/googleIdentity'

interface Props {
  onCredential: (idToken: string, nonce: string) => void
  // When set, clicks go to onBlockedClick instead of opening Google (e.g. 16+ box unticked)
  blocked?: boolean
  onBlockedClick?: () => void
  disabled?: boolean
}

export default function GoogleButton({ onCredential, blocked, onBlockedClick, disabled }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const handlerRef = useRef(onCredential)
  handlerRef.current = onCredential
  const [failed, setFailed] = useState(false)

  // Google's button has a fixed pixel width, so re-render it when the container
  // resizes (or first becomes visible: the signup screen has a hidden mobile copy)
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    let renderedWidth = 0
    const observer = new ResizeObserver(() => {
      const width = Math.round(el.clientWidth)
      if (!width || width === renderedWidth) return
      renderedWidth = width
      renderGoogleButton(el, width, (token, nonce) => handlerRef.current(token, nonce)).catch(() => setFailed(true))
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  if (failed) return <p className="text-xs text-center text-neutral-500">Google sign-in couldn't load. Check your connection or ad blocker.</p>

  return (
    <div className={`relative h-[44px] ${disabled ? 'opacity-60 pointer-events-none' : ''}`}>
      <div ref={containerRef} className="flex justify-center w-full" />
      {blocked && (
        <button
          type="button"
          aria-label="Continue with Google"
          onClick={onBlockedClick}
          className="absolute inset-0 w-full cursor-pointer"
        />
      )}
    </div>
  )
}

export function OrDivider() {
  return (
    <div className="flex items-center gap-3 text-xs font-extrabold uppercase tracking-widest text-neutral-500">
      <span className="flex-1 border-t-2 border-ink/20" />
      or
      <span className="flex-1 border-t-2 border-ink/20" />
    </div>
  )
}

export { googleSignInEnabled }
