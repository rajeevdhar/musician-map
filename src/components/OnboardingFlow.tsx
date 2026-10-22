import { useState, useRef } from 'react'
import { MapPin, Loader2 } from 'lucide-react'
import { useStore } from '../store'
import { INSTRUMENT_OPTIONS, GENRE_OPTIONS, LOOKING_FOR_OPTIONS } from '../types'
import type { Level } from '../types'

type Precision = 'exact' | 'area' | 'hidden'

const LEVEL_OPTIONS: Level[] = ['Beginner', 'Intermediate', 'Advanced', 'Pro']
const STEP_LABELS = ['Instruments', 'Genre & Level', 'Location', 'Looking For']

interface Data {
  instruments: string[]
  genres: string[]
  level: Level | ''
  lookingFor: string[]
  lat: number | null
  lng: number | null
  locationName: string
  locationPrecision: Precision
}

interface Props {
  onComplete: () => void
  onBack: () => void
}

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
      { headers: { 'Accept-Language': 'en' } }
    )
    const d = await res.json()
    const a = d.address ?? {}
    const city = a.city || a.town || a.village || a.county || ''
    return [city, a.state].filter(Boolean).join(', ') || 'Unknown location'
  } catch {
    return 'Unknown location'
  }
}

function jitter(n: number, radius = 0.03) {
  return n + (Math.random() - 0.5) * 2 * radius
}

export default function OnboardingFlow({ onComplete, onBack }: Props) {
  const { saveProfile, currentUser } = useStore()
  const [step, setStep] = useState(1)
  const [data, setData] = useState<Data>({
    instruments: [],
    genres: [],
    level: '',
    lookingFor: [],
    lat: null,
    lng: null,
    locationName: '',
    locationPrecision: 'area',
  })
  const [geoLoading, setGeoLoading] = useState(false)
  const [geoError, setGeoError] = useState('')
  const [cityInput, setCityInput] = useState('')
  const [saving, setSaving] = useState(false)
  const cityRef = useRef<HTMLInputElement>(null)

  const toggle = (field: 'instruments' | 'genres' | 'lookingFor', val: string) =>
    setData(d => ({
      ...d,
      [field]: d[field].includes(val) ? d[field].filter(x => x !== val) : [...d[field], val],
    }))

  const requestGeo = () => {
    setGeoLoading(true)
    setGeoError('')
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const locationName = await reverseGeocode(coords.latitude, coords.longitude)
        setData(d => ({ ...d, lat: coords.latitude, lng: coords.longitude, locationName }))
        setGeoLoading(false)
      },
      () => {
        setGeoLoading(false)
        setGeoError('Location access denied — enter your city below.')
        setTimeout(() => cityRef.current?.focus(), 50)
      },
      { timeout: 10000 }
    )
  }

  const handleCitySubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!cityInput.trim()) return
    // Use a rough US-center lat/lng as a placeholder; real geocoding would call Nominatim search
    setData(d => ({ ...d, lat: 39.5, lng: -98.35, locationName: cityInput.trim() }))
    setCityInput('')
    setGeoError('')
  }

  const canContinue =
    step === 1 ? data.instruments.length > 0 :
    step === 2 ? data.genres.length > 0 :
    step === 3 ? (data.locationPrecision === 'hidden' || data.lat !== null) :
    data.lookingFor.length > 0

  const handleComplete = async () => {
    if (!currentUser) return
    setSaving(true)
    let lat = data.lat ?? 0
    let lng = data.lng ?? 0
    if (data.locationPrecision === 'area' && data.lat !== null) {
      lat = jitter(lat)
      lng = jitter(lng)
    }
    await saveProfile({
      displayName: currentUser.displayName,
      bio: '',
      instruments: data.instruments,
      genres: data.genres,
      contactEmail: currentUser.email,
      lat: data.locationPrecision === 'hidden' ? 0 : lat,
      lng: data.locationPrecision === 'hidden' ? 0 : lng,
      locationName: data.locationName,
      lookingFor: data.lookingFor.join(', '),
      locationPrecision: data.locationPrecision,
      level: data.level || undefined,
    })
    setSaving(false)
    onComplete()
  }

  const goBack = () => step > 1 ? setStep(s => s - 1) : onBack()
  const goNext = () => canContinue && (step < 4 ? setStep(s => s + 1) : handleComplete())

  return (
    <div className="fixed inset-0 z-[2000] bg-ground flex flex-col">
      {/* Progress */}
      <div className="flex gap-1 px-4 pt-4 flex-shrink-0">
        {[1, 2, 3, 4].map(s => (
          <div key={s} className={`flex-1 h-1.5 transition-colors ${s <= step ? 'bg-accent' : 'bg-neutral-300'}`} />
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 pt-5 pb-4 max-w-[620px] mx-auto w-full">
        <p className="text-[11px] font-extrabold uppercase tracking-widest text-accent-700 mb-2">
          Step {step} of 4 · {STEP_LABELS[step - 1]}
        </p>

        {/* ── Step 1: Instruments ── */}
        {step === 1 && (
          <>
            <h2 className="text-[36px] font-extrabold text-ink mb-5 leading-tight">What do you play?</h2>
            <div className="flex flex-wrap gap-1.5">
              {INSTRUMENT_OPTIONS.map(i => (
                <button
                  key={i}
                  onClick={() => toggle('instruments', i)}
                  className={`h-[34px] px-2.5 border-2 border-ink text-[13px] font-semibold transition-colors ${
                    data.instruments.includes(i) ? 'bg-ink text-white' : 'text-ink hover:bg-accent-100'
                  }`}
                >
                  {i}
                </button>
              ))}
            </div>
          </>
        )}

        {/* ── Step 2: Genre + Level ── */}
        {step === 2 && (
          <>
            <h2 className="text-[36px] font-extrabold text-ink mb-4 leading-tight">What's your sound?</h2>
            <p className="text-[11px] font-extrabold uppercase tracking-widest text-neutral-700 mb-2">Genres</p>
            <div className="flex flex-wrap gap-1.5 mb-6">
              {GENRE_OPTIONS.map(g => (
                <button
                  key={g}
                  onClick={() => toggle('genres', g)}
                  className={`h-[34px] px-2.5 border-2 border-ink text-[13px] font-semibold transition-colors ${
                    data.genres.includes(g) ? 'bg-ink text-white' : 'text-ink hover:bg-accent-100'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
            <p className="text-[11px] font-extrabold uppercase tracking-widest text-neutral-700 mb-2">Skill level (optional)</p>
            <div className="border-2 border-ink grid grid-cols-4">
              {LEVEL_OPTIONS.map((l, i) => (
                <button
                  key={l}
                  onClick={() => setData(d => ({ ...d, level: d.level === l ? '' : l }))}
                  className={`h-10 text-[12px] font-extrabold text-left pl-2 transition-colors ${i > 0 ? 'border-l-2 border-ink' : ''} ${
                    data.level === l ? 'bg-ink text-white' : 'text-ink hover:bg-accent-100'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </>
        )}

        {/* ── Step 3: Location precision ── */}
        {step === 3 && (
          <>
            <h2 className="text-[36px] font-extrabold text-ink mb-4 leading-tight">How should others see where you are?</h2>

            {/* Location getter */}
            {!data.lat ? (
              <div className="mb-5">
                <button
                  onClick={requestGeo}
                  disabled={geoLoading}
                  className="w-full h-[52px] border-2 border-ink text-[15px] font-extrabold flex items-center gap-3 px-4 hover:bg-accent-100 transition-colors disabled:opacity-60"
                >
                  {geoLoading ? <Loader2 size={16} className="animate-spin" /> : <MapPin size={16} />}
                  {geoLoading ? 'Getting location…' : 'Use my location'}
                </button>
                {geoError && (
                  <>
                    <p className="text-sm text-accent-700 mt-2 mb-2">{geoError}</p>
                    <form onSubmit={handleCitySubmit} className="flex gap-2">
                      <input
                        ref={cityRef}
                        type="text"
                        value={cityInput}
                        onChange={e => setCityInput(e.target.value)}
                        placeholder="City, State"
                        className="flex-1 h-12 bg-white border-2 border-ink px-3 text-[15px] text-ink focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
                      />
                      <button type="submit" className="h-12 px-4 bg-ink text-white font-extrabold text-sm hover:bg-neutral-800 transition-colors">
                        Set
                      </button>
                    </form>
                  </>
                )}
              </div>
            ) : (
              <p className="text-[14px] font-semibold text-ink mb-4 flex items-center gap-2">
                <MapPin size={14} className="text-accent flex-shrink-0" />
                {data.locationName}
                <button
                  onClick={() => setData(d => ({ ...d, lat: null, lng: null, locationName: '' }))}
                  className="ml-1 text-neutral-500 underline text-[13px] font-normal"
                >
                  Change
                </button>
              </p>
            )}

            {/* Map preview */}
            <div className="h-[140px] border-2 border-ink bg-neutral-200 relative overflow-hidden mb-5 flex-shrink-0">
              <div className="absolute inset-0 flex items-center justify-center">
                {data.locationPrecision === 'exact' && (
                  <div className="w-[18px] h-[18px] bg-accent" style={{ transition: 'all .25s' }} />
                )}
                {data.locationPrecision === 'area' && (
                  <div
                    className="w-[110px] h-[110px]"
                    style={{
                      border: '2px dashed var(--color-accent)',
                      background: 'rgba(236,48,19,.12)',
                      transition: 'all .25s',
                    }}
                  />
                )}
                {data.locationPrecision === 'hidden' && (
                  <p className="text-neutral-400 text-sm font-semibold">Hidden from map</p>
                )}
              </div>
              <div className="absolute bottom-0 left-0 bg-ink text-white text-[11px] font-extrabold px-2 py-1">
                Others see:{' '}
                {data.locationPrecision === 'exact' ? 'Exact pin' :
                 data.locationPrecision === 'area' ? 'Approximate area' : 'Nothing'}
              </div>
            </div>

            {/* Radio rows */}
            <div className="flex flex-col gap-2">
              {([
                { value: 'exact', label: 'Exact pin', desc: 'Your precise location appears on the map.' },
                { value: 'area', label: 'Approximate area', desc: 'Only the neighborhood is shown. Your exact address is never stored.' },
                { value: 'hidden', label: 'Hidden from map', desc: "You won't appear on the map, but can still browse and message others." },
              ] as { value: Precision; label: string; desc: string }[]).map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setData(d => ({ ...d, locationPrecision: opt.value }))}
                  className={`grid items-start gap-3 p-3 border-2 text-left transition-colors ${
                    data.locationPrecision === opt.value ? 'border-accent bg-accent-100' : 'border-ink hover:bg-accent-100'
                  }`}
                  style={{ gridTemplateColumns: '24px 1fr' }}
                >
                  <div className={`mt-0.5 w-[22px] h-[22px] border-2 flex items-center justify-center flex-shrink-0 ${
                    data.locationPrecision === opt.value ? 'border-accent' : 'border-ink'
                  }`}>
                    {data.locationPrecision === opt.value && <div className="w-[10px] h-[10px] bg-accent" />}
                  </div>
                  <div>
                    <p className="text-[16px] font-extrabold text-ink">{opt.label}</p>
                    <p className="text-[13px] text-neutral-700 mt-0.5">{opt.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        {/* ── Step 4: Looking For ── */}
        {step === 4 && (
          <>
            <h2 className="text-[36px] font-extrabold text-ink mb-5 leading-tight">What are you looking for?</h2>
            <div className="flex flex-wrap gap-1.5">
              {LOOKING_FOR_OPTIONS.map(lf => (
                <button
                  key={lf}
                  onClick={() => toggle('lookingFor', lf)}
                  className={`h-[34px] px-2.5 border-2 border-ink text-[13px] font-semibold transition-colors ${
                    data.lookingFor.includes(lf) ? 'bg-ink text-white' : 'text-ink hover:bg-accent-100'
                  }`}
                >
                  {lf}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 flex border-t-2 border-ink">
        <button
          onClick={goBack}
          className="h-14 px-6 border-r-2 border-ink text-[14px] font-extrabold text-ink hover:bg-accent-100 transition-colors whitespace-nowrap"
        >
          ← Back
        </button>
        <button
          onClick={goNext}
          disabled={!canContinue || saving}
          className="flex-1 h-14 bg-accent hover:bg-accent-600 disabled:opacity-40 text-white font-extrabold text-[15px] flex items-center justify-between px-4 transition-colors"
        >
          <span>{step === 4 ? (saving ? 'Saving…' : 'Go to the map') : 'Continue'}</span>
          <span>→</span>
        </button>
      </div>
    </div>
  )
}
