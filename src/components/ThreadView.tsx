import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowUp } from 'lucide-react'
import { useStore } from '../store'
import { getInitials } from '../lib/musicianUtils'

interface Props {
  musicianId: string
  onBack: () => void
  onViewProfile: (id: string) => void
}

function formatTime(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

export default function ThreadView({ musicianId, onBack, onViewProfile }: Props) {
  const { musicians, threads, currentUser, sendMessage, markThreadRead } = useStore()
  const musician = musicians.find(m => m.id === musicianId)
  const messages = threads[musicianId] ?? []
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    markThreadRead(musicianId)
  }, [musicianId]) // eslint-disable-line

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  const handleSend = async () => {
    const trimmed = body.trim()
    if (!trimmed || sending) return
    setSending(true)
    setBody('')
    await sendMessage(musicianId, trimmed)
    setSending(false)
    inputRef.current?.focus()
  }

  const initials = musician ? getInitials(musician.displayName) : '??'
  const firstName = musician?.displayName.split(' ')[0] ?? 'them'

  if (!musician) {
    return (
      <div className="flex-1 flex items-center justify-center text-neutral-500 text-sm">
        Musician not found.
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center gap-3 px-4 h-14 border-b-2 border-ink">
        <button
          onClick={onBack}
          className="lg:hidden w-8 h-8 flex items-center justify-center hover:bg-accent-100 transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        {musician.avatarUrl ? (
          <img
            src={musician.avatarUrl}
            alt={musician.displayName}
            onClick={() => onViewProfile(musicianId)}
            className="w-9 h-9 object-cover flex-shrink-0 cursor-pointer grayscale hover:grayscale-0 transition-all"
          />
        ) : (
          <div
            className="w-9 h-9 bg-ink flex items-center justify-center text-white text-[13px] font-extrabold flex-shrink-0 cursor-pointer hover:bg-neutral-700 transition-colors select-none"
            onClick={() => onViewProfile(musicianId)}
          >
            {initials}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-extrabold text-ink leading-tight truncate">{musician.displayName}</p>
          <button
            onClick={() => onViewProfile(musicianId)}
            className="text-[12px] text-accent-700 underline underline-offset-2 hover:text-accent-600"
          >
            View profile
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-2">
        {messages.length === 0 && (
          <p className="text-center text-sm text-neutral-500 mt-8">
            Start a conversation with {firstName}.
          </p>
        )}
        {messages.map(msg => {
          const isMine = msg.fromId === currentUser?.id
          return (
            <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
              <div className="flex flex-col gap-0.5 max-w-[78%]">
                <div className={`px-3 py-3 text-[15px] leading-[1.4] ${
                  isMine
                    ? 'bg-accent text-white'
                    : 'bg-white border-2 border-ink text-ink'
                }`}>
                  {msg.body}
                </div>
                <p className={`text-[11px] text-neutral-500 ${isMine ? 'text-right' : 'text-left'}`}>
                  {formatTime(msg.createdAt)}
                </p>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <div className="flex-shrink-0 flex border-t-2 border-ink">
        <input
          ref={inputRef}
          type="text"
          value={body}
          onChange={e => setBody(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSend() }}
          placeholder={`Message ${firstName}`}
          className="flex-1 h-12 bg-white px-4 text-[15px] text-ink placeholder:text-neutral-400 focus:outline-none"
        />
        <button
          onClick={handleSend}
          disabled={!body.trim() || sending}
          className="w-12 h-12 bg-accent hover:bg-accent-600 disabled:opacity-40 text-white flex items-center justify-center flex-shrink-0 border-l-2 border-ink transition-colors"
        >
          <ArrowUp size={18} />
        </button>
      </div>
    </div>
  )
}
