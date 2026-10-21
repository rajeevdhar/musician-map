import { useState } from 'react'
import { useStore } from '../store'
import { INSTRUMENT_OPTIONS, GENRE_OPTIONS, LOOKING_FOR_OPTIONS } from '../types'
import type { Musician } from '../types'
import { supabase } from '../lib/supabase'

interface Props {
  onClose: () => void
  adminTarget?: Musician
  onAdminSaved?: () => void
}

type GeoStatus = 'idle' | 'searching' | 'found' | 'error'

async function geocodeLocation(query: string): Promise<{ lat: number; lng: number; display: string } | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&addressdetails=1`
    const res = await fetch(url, { headers: { 'User-Agent': 'MusicianMap/1.0' } })
    const data = await res.json()
    if (data && data[0]) {
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
        display: data[0].display_name.split(',').slice(0, 3).join(', '),
      }
    }
  } catch {}
  return null
}

function TagSelector({
  label, options, selected, onChange,
}: {
  label: string; options: string[]; selected: string[]; onChange: (v: string[]) => void; color?: string
}) {
  const toggle = (opt: string) =>
    onChange(selected.includes(opt) ? selected.filter(x => x !== opt) : [...selected, opt])

  return (
    <div>
      <label className="block text-xs font-extrabold uppercase tracking-widest text-neutral-700 mb-2">{label}</label>
      <div className="flex flex-wrap gap-1.5">
        {options.map(opt => (
          <button
            key={opt}
            type="button"
            onClick={() => toggle(opt)}
            className={`h-[34px] px-2.5 text-xs font-semibold transition-colors border-2 border-ink ${
              selected.includes(opt)
                ? 'bg-ink text-white'
                : 'bg-white text-ink hover:bg-accent-100'
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function ProfileModal({ onClose, adminTarget, onAdminSaved }: Props) {
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [saving, setSaving] = useState(false)
  const { currentUser, saveProfile, currentProfile, removeProfile, deleteAccount, fetchMusicians } = useStore()

  const isAdminMode = !!adminTarget
  const source = adminTarget ?? currentProfile()

  const [displayName, setDisplayName] = useState(source?.displayName ?? currentUser?.displayName ?? '')
  const [bio, setBio] = useState(source?.bio ?? '')
  const [instruments, setInstruments] = useState<string[]>(source?.instruments ?? [])
  const [genres, setGenres] = useState<string[]>(source?.genres ?? [])
  const [lookingFor, setLookingFor] = useState<string[]>(
    source?.lookingFor ? source.lookingFor.split(',').map(s => s.trim()).filter(Boolean) : []
  )
  const [contactEmail, setContactEmail] = useState(source?.contactEmail ?? currentUser?.email ?? '')
  const [locationQuery, setLocationQuery] = useState(source?.locationName ?? '')
  const [lat, setLat] = useState<number | null>(source?.lat ?? null)
  const [lng, setLng] = useState<number | null>(source?.lng ?? null)
  const [locationName, setLocationName] = useState(source?.locationName ?? '')
  const [geoStatus, setGeoStatus] = useState<GeoStatus>('idle')
  const [error, setError] = useState('')

  const detectLocation = () => {
    if (!navigator.geolocation) return
    setGeoStatus('searching')
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const { latitude, longitude } = pos.coords
        try {
          const url = `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
          const res = await fetch(url, { headers: { 'User-Agent': 'MusicianMap/1.0' } })
          const data = await res.json()
          const display = data.display_name?.split(',').slice(0, 3).join(', ') ?? 'Your location'
          setLat(latitude); setLng(longitude)
          setLocationName(display); setLocationQuery(display)
          setGeoStatus('found')
        } catch {
          setLat(latitude); setLng(longitude)
          setLocationName('Detected location'); setLocationQuery('Detected location')
          setGeoStatus('found')
        }
      },
      () => setGeoStatus('error')
    )
  }

  const searchLocation = async () => {
    if (!locationQuery.trim()) return
    setGeoStatus('searching')
    const result = await geocodeLocation(locationQuery)
    if (result) {
      setLat(result.lat); setLng(result.lng)
      setLocationName(result.display); setLocationQuery(result.display)
      setGeoStatus('found')
    } else {
      setGeoStatus('error')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!displayName.trim()) { setError('Display name is required'); return }
    if (instruments.length === 0) { setError('Select at least one instrument'); return }
    if (!lat || !lng) { setError('Please set your location'); return }

    setSaving(true)

    if (isAdminMode && adminTarget) {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`/api/admin/profile/${adminTarget.id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          display_name: displayName.trim(),
          bio: bio.trim(),
          instruments,
          genres,
          contact_email: contactEmail.trim(),
          lat,
          lng,
          location_name: locationName,
          looking_for: lookingFor.join(', '),
        }),
      })
      const result = await res.json()
      if (!result.ok) { setError(result.error ?? 'Save failed'); setSaving(false); return }
      await fetchMusicians()
      onAdminSaved?.()
    } else {
      await saveProfile({
        displayName: displayName.trim(),
        bio: bio.trim(),
        instruments,
        genres,
        contactEmail: contactEmail.trim(),
        lat,
        lng,
        locationName,
        lookingFor: lookingFor.join(', '),
      })
    }

    setSaving(false)
    onClose()
  }

  const handleRemove = async () => {
    await removeProfile()
    onClose()
  }

  const handleDeleteAccount = async () => {
    await deleteAccount()
    onClose()
  }

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-box">
        <div className="sticky top-0 bg-white flex items-center justify-between px-6 pt-5 pb-3 border-b border-gray-100 z-10">
          <div>
            <h2 className="text-xl font-extrabold text-ink">
              {isAdminMode
                ? `Admin: ${source ? 'Edit Profile' : 'No Profile'}`
                : source ? 'Edit Your Profile' : 'Set Up Your Profile'}
            </h2>
            {isAdminMode && adminTarget && (
              <p className="text-xs text-accent-700 mt-0.5 font-bold">Editing {adminTarget.displayName}</p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label className="block text-xs font-extrabold uppercase tracking-widest text-neutral-700 mb-1">Display / Artist Name</label>
            <input
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              className="w-full h-12 bg-white border-2 border-ink px-3 text-sm focus:outline-none"
              placeholder="Your name or band name"
            />
          </div>

          <div>
            <label className="block text-xs font-extrabold uppercase tracking-widest text-neutral-700 mb-1">Bio</label>
            <textarea
              value={bio}
              onChange={e => setBio(e.target.value)}
              rows={3}
              className="w-full bg-white border-2 border-ink px-3 py-2 text-sm focus:outline-none resize-none"
              placeholder="Tell other musicians about yourself..."
            />
          </div>

          <TagSelector
            label="Instruments (select all that apply)"
            options={INSTRUMENT_OPTIONS}
            selected={instruments}
            onChange={setInstruments}
          />

          <TagSelector
            label="Genres"
            options={GENRE_OPTIONS}
            selected={genres}
            onChange={setGenres}
          />

          <TagSelector
            label="Looking for"
            options={LOOKING_FOR_OPTIONS}
            selected={lookingFor}
            onChange={setLookingFor}
          />

          <div>
            <label className="block text-xs font-extrabold uppercase tracking-widest text-neutral-700 mb-1">Contact Email (shown to other musicians)</label>
            <input
              type="email"
              value={contactEmail}
              onChange={e => setContactEmail(e.target.value)}
              className="w-full h-12 bg-white border-2 border-ink px-3 text-sm focus:outline-none"
              placeholder="contact@example.com"
            />
          </div>

          <div>
            <label className="block text-xs font-extrabold uppercase tracking-widest text-neutral-700 mb-1">
              Your Location <span className="font-normal normal-case tracking-normal">(shown on map)</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={locationQuery}
                onChange={e => { setLocationQuery(e.target.value); setGeoStatus('idle') }}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), searchLocation())}
                className="flex-1 h-12 bg-white border-2 border-ink px-3 text-sm focus:outline-none"
                placeholder="City, neighborhood, ZIP..."
              />
              <button type="button" onClick={searchLocation} className="px-3 h-12 bg-surface border-2 border-ink text-sm font-bold hover:bg-accent-100">
                Search
              </button>
              <button type="button" onClick={detectLocation} title="Use my current location" className="px-3 h-12 bg-surface border-2 border-ink text-sm hover:bg-accent-100">
                Locate
              </button>
            </div>
            {geoStatus === 'searching' && <p className="text-xs text-neutral-500 mt-1">Searching…</p>}
            {geoStatus === 'found' && <p className="text-xs text-accent-700 font-bold mt-1">Location set: {locationName}</p>}
            {geoStatus === 'error' && <p className="text-xs text-accent-700 mt-1">Location not found. Try a more specific address.</p>}
          </div>

          {error && (
            <p className="text-sm text-accent-700 bg-accent-100 border-2 border-accent px-3 py-2">{error}</p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-[52px] border-2 border-ink text-sm font-bold text-ink hover:bg-accent-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 flex items-center justify-between h-[52px] bg-accent hover:bg-accent-600 disabled:opacity-60 text-white text-sm font-bold px-4 transition-colors"
            >
              <span>{saving ? 'Saving…' : source ? 'Save Changes' : 'Add Me to the Map'}</span>
              <span>→</span>
            </button>
          </div>

          {/* Remove profile (not shown in admin mode — admin has its own controls) */}
          {source && !isAdminMode && (
            <div className="border-t-2 border-ink pt-4 mt-2">
              {!confirmRemove ? (
                <button
                  type="button"
                  onClick={() => setConfirmRemove(true)}
                  className="w-full py-2 text-sm text-accent-700 hover:bg-accent-100 transition-colors"
                >
                  Remove my profile from the map
                </button>
              ) : (
                <div className="border-2 border-ink p-3 space-y-2 bg-accent-100">
                  <p className="text-sm text-accent-700 font-bold">Remove your pin from the map?</p>
                  <p className="text-xs text-neutral-700">Your account stays active — you can add a profile again any time.</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmRemove(false)}
                      className="flex-1 py-2 text-xs border-2 border-ink text-ink hover:bg-accent-100"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleRemove}
                      className="flex-1 py-2 text-xs bg-accent hover:bg-accent-600 text-white font-bold"
                    >
                      Yes, remove me
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Delete account (only for self, not admin mode) */}
          {!isAdminMode && (
            <div className="border-t-2 border-ink pt-3">
              {!confirmDelete ? (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="w-full py-2 text-sm text-neutral-500 hover:text-accent-700 hover:bg-accent-100 transition-colors"
                >
                  Delete my account permanently
                </button>
              ) : (
                <div className="border-2 border-ink p-3 space-y-2 bg-accent-100">
                  <p className="text-sm text-accent-700 font-bold">Delete account permanently?</p>
                  <p className="text-xs text-neutral-700">This cannot be undone. Your profile, map pin and account will be deleted.</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      className="flex-1 py-2 text-xs border-2 border-ink text-ink hover:bg-accent-100"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleDeleteAccount}
                      className="flex-1 py-2 text-xs bg-accent hover:bg-accent-600 text-white font-bold"
                    >
                      Delete Everything
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </form>
      </div>
    </div>
  )
}
