import { useState } from 'react'
import { useStore } from '../store'
import { getInstrumentCode } from '../lib/musicianUtils'
import ThreadView from './ThreadView'

interface Props {
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

export default function InboxTab({ onViewProfile }: Props) {
  const {
    musicians, threads, unread, contactRequests, revealedContacts,
    respondToContactRequest, activeThreadId, setActiveThreadId, currentUser,
  } = useStore()
  const [tab, setTab] = useState<'chats' | 'requests'>('chats')

  const incomingIds = Object.keys(contactRequests.incoming)
  const threadIds = Object.keys(threads)

  const inboxMusicians = threadIds
    .map(id => ({ id, musician: musicians.find(m => m.id === id), msgs: threads[id] }))
    .filter(x => x.musician)
    .sort((a, b) => {
      const aLast = a.msgs[a.msgs.length - 1]?.createdAt ?? ''
      const bLast = b.msgs[b.msgs.length - 1]?.createdAt ?? ''
      return bLast.localeCompare(aLast)
    })

  const showThread = !!activeThreadId

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">
      {/* Inbox list — always on desktop, hidden on mobile when thread open */}
      <div className={`flex-col border-r-2 border-ink overflow-hidden flex-shrink-0 ${
        showThread ? 'hidden lg:flex lg:w-[380px]' : 'flex w-full lg:w-[380px]'
      }`}>
        {/* Segmented tabs */}
        <div className="border-2 border-ink mx-3 mt-3 mb-0 grid grid-cols-2 flex-shrink-0">
          <button
            onClick={() => setTab('chats')}
            className={`h-10 text-[12px] font-extrabold pl-2 transition-colors ${
              tab === 'chats' ? 'bg-ink text-white' : 'text-ink hover:bg-accent-100'
            }`}
          >
            Chats
          </button>
          <button
            onClick={() => setTab('requests')}
            className={`h-10 text-[12px] font-extrabold pl-2 border-l-2 border-ink transition-colors ${
              tab === 'requests' ? 'bg-ink text-white' : 'text-ink hover:bg-accent-100'
            }`}
          >
            Requests {incomingIds.length > 0 && <span className="ml-1 text-accent">{incomingIds.length}</span>}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto mt-3">
          {tab === 'chats' && (
            <>
              {inboxMusicians.length === 0 && (
                <p className="px-4 py-8 text-sm text-neutral-500 text-center">No conversations yet.</p>
              )}
              {inboxMusicians.map(({ id, musician, msgs }) => {
                if (!musician) return null
                const last = msgs[msgs.length - 1]
                const isMine = last?.fromId === currentUser?.id
                const hasUnread = unread[id]
                const isActive = activeThreadId === id
                const code = getInstrumentCode(musician.instruments)
                return (
                  <button
                    key={id}
                    onClick={() => setActiveThreadId(id)}
                    className={`group w-full text-left border-t-2 border-ink transition-colors relative ${
                      isActive ? 'bg-accent-100' : 'hover:bg-accent-100 active:bg-accent-200'
                    }`}
                  >
                    {isActive && <div className="absolute left-0 top-0 bottom-0 w-1 bg-accent" />}
                    <div className="grid gap-0 pl-2 pr-3 py-2.5" style={{ gridTemplateColumns: '40px 1fr auto' }}>
                      {musician.avatarUrl ? (
                        <img src={musician.avatarUrl} alt={musician.displayName} className="w-9 h-9 object-cover flex-shrink-0 mt-0.5 grayscale" />
                      ) : (
                        <div className="w-9 h-9 bg-accent group-hover:bg-ink text-white text-[12px] font-extrabold flex-shrink-0 mt-0.5 flex items-center justify-center transition-colors">
                          {code}
                        </div>
                      )}
                      <div className="pl-2.5 min-w-0">
                        <p className="text-[15px] font-extrabold text-ink group-hover:text-accent truncate transition-colors">{musician.displayName}</p>
                        {last && (
                          <p className="text-[13px] text-neutral-700 truncate">
                            {isMine ? 'You: ' : ''}{last.body}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1 pl-2 flex-shrink-0">
                        {last && <p className="text-[11px] text-neutral-500">{formatTime(last.createdAt)}</p>}
                        {hasUnread && <div className="w-2 h-2 bg-accent flex-shrink-0" />}
                      </div>
                    </div>
                  </button>
                )
              })}
            </>
          )}

          {tab === 'requests' && (
            <>
              {incomingIds.length === 0 && (
                <p className="px-4 py-8 text-sm text-neutral-500 text-center">No pending requests.</p>
              )}
              {incomingIds.map(fromId => {
                const musician = musicians.find(m => m.id === fromId)
                if (!musician) return null
                const code = getInstrumentCode(musician.instruments)
                return (
                  <div key={fromId} className="border-t-2 border-ink mx-3 mt-3 border-2 border-accent bg-accent-100 p-3">
                    <p className="text-[11px] font-extrabold uppercase tracking-widest text-accent-700 mb-2">
                      Contact request
                    </p>
                    <div className="flex items-center gap-2 mb-3">
                      {musician.avatarUrl ? (
                        <img src={musician.avatarUrl} alt={musician.displayName} className="w-9 h-9 object-cover flex-shrink-0 grayscale" />
                      ) : (
                        <div className="w-9 h-9 bg-accent flex items-center justify-center text-white text-[12px] font-extrabold flex-shrink-0">
                          {code}
                        </div>
                      )}
                      <div>
                        <p className="text-[15px] font-extrabold text-ink">{musician.displayName}</p>
                        <p className="text-[13px] text-neutral-700">{musician.instruments.slice(0, 2).join(', ')}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 border-t-2 border-accent -mx-3 -mb-3">
                      <button
                        onClick={() => respondToContactRequest(fromId, true)}
                        className="h-11 bg-accent hover:bg-accent-600 text-white font-extrabold text-[13px] flex items-center justify-between px-3 transition-colors"
                      >
                        <span>Share contact</span>
                        <span>→</span>
                      </button>
                      <button
                        onClick={() => respondToContactRequest(fromId, false)}
                        className="h-11 border-l-2 border-accent bg-transparent hover:bg-accent-200 text-accent-700 font-extrabold text-[13px] flex items-center px-3 transition-colors"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                )
              })}

              {/* Revealed contacts */}
              {Object.entries(revealedContacts).map(([id, contact]) => {
                const musician = musicians.find(m => m.id === id)
                if (!musician) return null
                return (
                  <div key={id} className="border-t-2 border-ink px-4 py-3">
                    <p className="text-[11px] font-extrabold uppercase tracking-widest text-accent-700 mb-1">
                      Contact shared
                    </p>
                    <p className="text-[15px] font-extrabold text-ink">{musician.displayName}</p>
                    <p className="text-[14px] text-ink mt-1">{contact.email}</p>
                    {contact.phone && <p className="text-[14px] text-ink">{contact.phone}</p>}
                  </div>
                )
              })}
            </>
          )}
        </div>
      </div>

      {/* Thread panel — right on desktop, full screen on mobile */}
      {showThread ? (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <ThreadView
            musicianId={activeThreadId!}
            onBack={() => setActiveThreadId(null)}
            onViewProfile={onViewProfile}
          />
        </div>
      ) : (
        <div className="hidden lg:flex flex-1 items-center justify-center">
          <p className="text-sm text-neutral-500">Select a conversation</p>
        </div>
      )}
    </div>
  )
}
