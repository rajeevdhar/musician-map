import { useState } from 'react'
import { Heart, MessageSquare } from 'lucide-react'
import { useStore } from '../store'
import { getInstrumentCode } from '../lib/musicianUtils'

interface Props {
  onViewProfile: (id: string) => void
}

export default function SavedTab({ onViewProfile }: Props) {
  const { musicians, saved, toggleSaved, updateNote, setActiveTab, setActiveThreadId } = useStore()
  const savedMusicians = musicians.filter(m => saved[m.id] !== undefined)

  if (savedMusicians.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center flex-col gap-3 p-8 text-center">
        <Heart size={36} className="text-neutral-300" />
        <p className="text-[20px] font-extrabold text-ink">No saved musicians yet.</p>
        <p className="text-sm text-neutral-700">Tap the heart on any profile to save them here.</p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Header */}
      <div className="border-b-2 border-ink px-4 py-3 flex items-baseline gap-3">
        <span className="text-[44px] font-extrabold text-ink leading-none tracking-[-0.03em]">
          {savedMusicians.length}
        </span>
        <span className="text-[20px] font-extrabold text-ink">saved</span>
      </div>

      {savedMusicians.map(m => {
        const code = getInstrumentCode(m.instruments)
        const isArea = m.locationPrecision === 'area'
        const note = saved[m.id] ?? ''
        const isSeed = m.id.startsWith('seed-')
        return (
          <SavedRow
            key={m.id}
            code={code}
            isArea={isArea}
            name={m.displayName}
            instruments={m.instruments}
            genres={m.genres}
            note={note}
            isSeed={isSeed}
            onView={() => onViewProfile(m.id)}
            onUnsave={() => toggleSaved(m.id)}
            onNoteChange={n => updateNote(m.id, n)}
            onMessage={() => {
              setActiveThreadId(m.id)
              setActiveTab('messages')
            }}
          />
        )
      })}
    </div>
  )
}

interface RowProps {
  code: string
  isArea: boolean
  name: string
  instruments: string[]
  genres: string[]
  note: string
  isSeed: boolean
  onView: () => void
  onUnsave: () => void
  onNoteChange: (n: string) => void
  onMessage: () => void
}

function SavedRow({ code, isArea, name, instruments, genres, note, isSeed, onView, onUnsave, onNoteChange, onMessage }: RowProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(note)

  return (
    <div className="border-t-2 border-ink">
      <div
        className="group grid gap-0 cursor-pointer hover:bg-accent-100 active:bg-accent-200 transition-colors"
        style={{ gridTemplateColumns: '52px 1fr auto' }}
        onClick={onView}
      >
        {/* Code block */}
        <div className={`min-h-[52px] m-2 mr-0 flex items-start pt-1 pl-1.5 text-[13px] font-extrabold transition-colors ${
          isArea
            ? 'border-2 border-dashed border-accent text-accent-700'
            : 'bg-accent group-hover:bg-ink text-white'
        }`}>
          {code}
        </div>

        {/* Middle */}
        <div className="px-3 py-2.5 min-w-0">
          <p className="text-[16px] font-extrabold text-ink group-hover:text-accent leading-tight truncate transition-colors">{name}</p>
          <p className="text-[13px] text-neutral-700 truncate mt-0.5">
            {instruments.slice(0, 2).join(', ')}
            {genres.length > 0 && ` · ${genres.slice(0, 2).join(', ')}`}
          </p>
        </div>

        {/* Heart unsave */}
        <button
          onClick={e => { e.stopPropagation(); onUnsave() }}
          className="w-12 flex items-center justify-center border-l-2 border-ink hover:bg-accent-100 transition-colors text-accent flex-shrink-0"
          title="Remove from saved"
        >
          <Heart size={16} fill="currentColor" />
        </button>
      </div>

      {/* Note row */}
      <div className="px-3 pb-2.5 flex items-center gap-2" onClick={e => e.stopPropagation()}>
        {editing ? (
          <input
            autoFocus
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={() => { setEditing(false); onNoteChange(draft) }}
            onKeyDown={e => { if (e.key === 'Enter') { setEditing(false); onNoteChange(draft) } }}
            className="flex-1 h-8 bg-white border-2 border-ink px-2 text-[13px] text-ink focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-1"
            placeholder="Add a private note…"
          />
        ) : (
          <button
            onClick={() => { setDraft(note); setEditing(true) }}
            className="flex-1 text-left text-[13px] italic text-neutral-500 hover:text-neutral-700 truncate"
          >
            {note || 'Add a private note…'}
          </button>
        )}
        {!isSeed && (
          <button
            onClick={onMessage}
            className="flex-shrink-0 w-8 h-8 border-2 border-ink flex items-center justify-center hover:bg-accent-100 transition-colors text-ink"
            title="Message"
          >
            <MessageSquare size={14} />
          </button>
        )}
      </div>
    </div>
  )
}
