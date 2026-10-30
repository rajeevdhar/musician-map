import { useState, useRef, useEffect } from 'react'
import { X, Navigation, Camera, Globe, Instagram, Youtube, Music, PlayCircle, Trash2, Tent, Video, KeyRound, MessageCircle } from 'lucide-react'
import { useStore } from '../store'
import { INSTRUMENT_OPTIONS, GENRE_OPTIONS, LOOKING_FOR_OPTIONS } from '../types'
import type { Musician, Level } from '../types'
import { supabase } from '../lib/supabase'
import { STATE_ABBR } from '../lib/musicianUtils'
import { moderateImage, blobToImg } from '../lib/moderateImage'
import L from 'leaflet'

type Precision = 'exact' | 'area' | 'hidden'
type GeoStatus = 'idle' | 'searching' | 'found' | 'error'

const LEVEL_OPTIONS: Level[] = ['Beginner', 'Intermediate', 'Advanced', 'Pro']
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const SLOTS = ['Morning', 'Afternoon', 'Evening']

function roundCoord(n: number) { return Math.round(n * 100) / 100 }
function emptyAvail(): boolean[][] { return Array.from({ length: 7 }, () => [false, false, false]) }

// Extract "City, ST" from a Nominatim address object
function nominatimCityState(addr: Record<string, string>): string {
  const city = addr.city ?? addr.town ?? addr.village ?? addr.hamlet ?? addr.suburb ?? ''
  const state = addr.state ? (STATE_ABBR[addr.state] ?? addr.state) : ''
  if (city && state) return `${city}, ${state}`
  return city || state || ''
}

type Suggestion = { lat: number; lng: number; display: string; locationName: string }

async function fetchSuggestions(query: string): Promise<Suggestion[]> {
  if (query.length < 3) return []
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=1`
    const res = await fetch(url, { headers: { 'User-Agent': 'MusicianMap/1.0' } })
    const data = await res.json() as Array<{ lat: string; lon: string; display_name: string; address?: Record<string, string> }>
    return data.map(r => ({
      lat: parseFloat(r.lat),
      lng: parseFloat(r.lon),
      display: r.display_name.split(',').slice(0, 4).join(', '),
      locationName: r.address ? nominatimCityState(r.address) : r.display_name.split(',').slice(0, 2).join(', '),
    }))
  } catch { return [] }
}

function LocationPinMap({ lat, lng, onChange, onAddress }: {
  lat: number; lng: number
  onChange: (lat: number, lng: number) => void
  onAddress?: (display: string, locationName: string) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)
  const onAddressRef = useRef(onAddress)
  useEffect(() => { onAddressRef.current = onAddress })
  useEffect(() => {
    if (!containerRef.current || isNaN(lat) || isNaN(lng)) return
    const map = L.map(containerRef.current, { zoomControl: true }).setView([lat, lng], 14)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 19,
    }).addTo(map)
    const icon = new L.DivIcon({
      className: '',
      html: '<div style="width:14px;height:14px;background:var(--color-accent);border:2px solid #fff;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,.4);"></div>',
      iconSize: [14, 14],
      iconAnchor: [7, 7],
    })
    const marker = L.marker([lat, lng], { draggable: true, icon }).addTo(map)
    marker.on('dragend', async () => {
      const pos = marker.getLatLng()
      onChange(pos.lat, pos.lng)
      if (onAddressRef.current) {
        try {
          const url = `https://nominatim.openstreetmap.org/reverse?lat=${pos.lat}&lon=${pos.lng}&format=json&addressdetails=1`
          const res = await fetch(url, { headers: { 'User-Agent': 'MusicianMap/1.0' } })
          const data = await res.json()
          const cityState = data.address ? nominatimCityState(data.address as Record<string, string>) : ''
          const display = data.display_name?.split(',').slice(0, 4).join(', ') ?? ''
          onAddressRef.current(display, cityState || display)
        } catch { /* keep existing address on error */ }
      }
    })
    mapRef.current = map
    markerRef.current = marker
    setTimeout(() => { if (mapRef.current) map.invalidateSize() }, 100)
    return () => { map.remove(); mapRef.current = null; markerRef.current = null }
  }, []) // eslint-disable-line

  useEffect(() => {
    if (!mapRef.current || !markerRef.current || isNaN(lat) || isNaN(lng)) return
    const c = mapRef.current.getCenter()
    if (Math.abs(c.lat - lat) < 1e-9 && Math.abs(c.lng - lng) < 1e-9) return
    markerRef.current.setLatLng([lat, lng])
    mapRef.current.setView([lat, lng], 14, { animate: true, duration: 0.6 })
  }, [lat, lng])

  return <div ref={containerRef} style={{ height: '260px' }} className="border-2 border-ink mt-2" />
}

async function resizeImage(file: File): Promise<Blob> {
  const MAX_DIM = 1400
  return new Promise((resolve, reject) => {
    const img = new Image()
    const blobUrl = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(blobUrl)
      let { width, height } = img
      if (width > MAX_DIM || height > MAX_DIM) {
        if (width >= height) { height = Math.round(height * MAX_DIM / width); width = MAX_DIM }
        else { width = Math.round(width * MAX_DIM / height); height = MAX_DIM }
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height)
      canvas.toBlob(blob => { blob ? resolve(blob) : reject(new Error('resize failed')) }, 'image/jpeg', 0.85)
    }
    img.onerror = () => { URL.revokeObjectURL(blobUrl); reject(new Error('load failed')) }
    img.src = blobUrl
  })
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] font-extrabold uppercase tracking-widest text-neutral-700 mb-2">{children}</p>
}

function TagPicker({ options, selected, onChange }: { options: string[]; selected: string[]; onChange: (v: string[]) => void }) {
  const toggle = (opt: string) =>
    onChange(selected.includes(opt) ? selected.filter(x => x !== opt) : [...selected, opt])
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(opt => (
        <button
          key={opt}
          type="button"
          onClick={() => toggle(opt)}
          className={`h-[34px] px-2.5 text-[12px] font-semibold border-2 border-ink transition-colors ${
            selected.includes(opt) ? 'bg-ink text-white' : 'bg-white text-ink hover:bg-accent-100'
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  )
}

interface Props {
  onClose: () => void
  adminTarget?: Musician
  onAdminSaved?: () => void
}

function normalizeUrl(raw: string): string {
  const s = raw.trim()
  if (!s) return ''
  if (/^https?:\/\//i.test(s)) return s
  return 'https://' + s
}

function normalizeInstagram(raw: string): string {
  const s = raw.trim()
  if (!s) return ''
  if (/^https?:\/\//i.test(s)) return s
  const handle = s.replace(/^@/, '')
  return `https://instagram.com/${handle}`
}

function normalizeTiktok(raw: string): string {
  const s = raw.trim()
  if (!s) return ''
  if (/^https?:\/\//i.test(s)) return s
  const handle = s.replace(/^@/, '')
  return `https://tiktok.com/@${handle}`
}

function normalizeDiscord(raw: string): string {
  const s = raw.trim()
  if (!s) return ''
  if (/^https?:\/\//i.test(s)) return s
  // Accept server invite codes (e.g. abc123 → discord.gg/abc123) or bare URLs
  if (/^discord\.gg\//i.test(s)) return `https://${s}`
  // If it looks like just a username/handle, return as-is
  return s
}

export default function ProfileModal({ onClose, adminTarget, onAdminSaved }: Props) {
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
  const [level, setLevel] = useState<Level | undefined>(source?.level)
  const [primaryInstrument, setPrimaryInstrument] = useState(source?.primaryInstrument ?? '')
  const [gear, setGear] = useState<string[]>(source?.gear ?? [])
  const [gearInput, setGearInput] = useState('')
  const [availability, setAvailability] = useState<boolean[][]>(source?.availability ?? emptyAvail())
  const [locationPrecision, setLocationPrecision] = useState<Precision>(source?.locationPrecision === 'hidden' ? 'hidden' : 'area')
  const [locationQuery, setLocationQuery] = useState(source?.locationName ?? '')
  const [lat, setLat] = useState<number | null>(() => { const v = source?.lat; return v != null && !isNaN(v) ? v : null })
  const [lng, setLng] = useState<number | null>(() => { const v = source?.lng; return v != null && !isNaN(v) ? v : null })
  const [locationName, setLocationName] = useState(source?.locationName ?? '')
  const [locationChanged, setLocationChanged] = useState(false)
  const [geoStatus, setGeoStatus] = useState<GeoStatus>('idle')
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const suggestTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [showChangePassword, setShowChangePassword] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState(source?.avatarUrl ?? '')
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const avatarFileRef = useRef<HTMLInputElement>(null)
  const cropContainerRef = useRef<HTMLDivElement>(null)
  const cropImgRef = useRef<HTMLImageElement>(null)
  const [cropMode, setCropMode] = useState(false)
  const [cropOffset, setCropOffset] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [renderedImgSize, setRenderedImgSize] = useState({ w: 0, h: 0 })
  const [websiteUrl, setWebsiteUrl] = useState(source?.websiteUrl ?? '')
  const [instagramUrl, setInstagramUrl] = useState(source?.instagramUrl ?? '')
  const [youtubeUrl, setYoutubeUrl] = useState(source?.youtubeUrl ?? '')
  const [soundcloudUrl, setSoundcloudUrl] = useState(source?.soundcloudUrl ?? '')
  const [bandcampUrl, setBandcampUrl] = useState(source?.bandcampUrl ?? '')
  const [tiktokUrl, setTiktokUrl] = useState(source?.tiktokUrl ?? '')
  const [discordUrl, setDiscordUrl] = useState(source?.discordUrl ?? '')
  const [audioUrl, setAudioUrl] = useState(source?.audioUrl ?? '')
  const [uploadingAudio, setUploadingAudio] = useState(false)
  const audioFileRef = useRef<HTMLInputElement>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const completeness = (() => {
    const fields = [
      displayName.trim().length > 0,
      bio.trim().length > 0,
      instruments.length > 0,
      genres.length > 0,
      lookingFor.length > 0,
      lat !== null || locationPrecision === 'hidden',
      !!level,
      gear.length > 0,
      !!primaryInstrument,
      availability.some(d => d.some(Boolean)),
    ]
    return Math.round(fields.filter(Boolean).length / fields.length * 100)
  })()

  const detectLocation = () => {
    if (!navigator.geolocation) return
    setGeoStatus('searching')
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const { latitude, longitude } = pos.coords
        try {
          const url = `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&addressdetails=1`
          const res = await fetch(url, { headers: { 'User-Agent': 'MusicianMap/1.0' } })
          const data = await res.json()
          const cityState = data.address ? nominatimCityState(data.address as Record<string, string>) : ''
          const display = data.display_name?.split(',').slice(0, 4).join(', ') ?? 'Your location'
          setLat(latitude); setLng(longitude)
          setLocationName(cityState || display); setLocationQuery(display)
          setLocationChanged(true); setGeoStatus('found')
        } catch {
          setLat(latitude); setLng(longitude)
          setLocationName('Detected location'); setLocationQuery('Detected location')
          setLocationChanged(true); setGeoStatus('found')
        }
      },
      () => setGeoStatus('error')
    )
  }

  const handleLocationInput = (q: string) => {
    setLocationQuery(q)
    setGeoStatus('idle')
    if (suggestTimer.current) clearTimeout(suggestTimer.current)
    if (q.length >= 3) {
      suggestTimer.current = setTimeout(async () => {
        const s = await fetchSuggestions(q)
        setSuggestions(s)
        setShowSuggestions(s.length > 0)
      }, 350)
    } else {
      setSuggestions([])
      setShowSuggestions(false)
    }
  }

  const pickSuggestion = (s: Suggestion) => {
    setLat(s.lat); setLng(s.lng)
    // Store city/state only; show full address in the input so user knows what was picked
    setLocationName(s.locationName || s.display); setLocationQuery(s.display)
    setLocationChanged(true); setGeoStatus('found')
    setShowSuggestions(false); setSuggestions([])
  }

  const addGear = () => {
    const t = gearInput.trim()
    if (t && !gear.includes(t)) { setGear(g => [...g, t]); setGearInput('') }
  }

  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 20 * 1024 * 1024) { setError('Audio file must be under 20 MB'); return }
    setUploadingAudio(true)
    setError('')
    const ext = file.name.split('.').pop() ?? 'mp3'
    const path = `${currentUser!.id}/clip.${ext}`
    const { error: uploadErr } = await supabase.storage
      .from('musician-audio')
      .upload(path, file, { upsert: true, contentType: file.type })
    if (uploadErr) { setError('Audio upload failed: ' + uploadErr.message); setUploadingAudio(false); return }
    const { data } = supabase.storage.from('musician-audio').getPublicUrl(path)
    setAudioUrl(`${data.publicUrl}?t=${Date.now()}`)
    setUploadingAudio(false)
    if (audioFileRef.current) audioFileRef.current.value = ''
  }

  const toggleAvailability = (day: number, slot: number) => {
    setAvailability(prev => {
      const next = prev.map(d => [...d])
      next[day][slot] = !next[day][slot]
      return next
    })
  }

  const initCropSize = (img: HTMLImageElement) => {
    const container = cropContainerRef.current
    if (!container) return
    const cW = container.clientWidth
    const cH = container.clientHeight
    const aspect = img.naturalWidth / img.naturalHeight
    let rW = cW, rH = cH
    if (aspect >= 1) { rH = cH; rW = rH * aspect; if (rW < cW) { rW = cW; rH = rW / aspect } }
    else { rW = cW; rH = rW / aspect; if (rH < cH) { rH = cH; rW = rH * aspect } }
    setRenderedImgSize({ w: rW, h: rH })
    setCropOffset({ x: (cW - rW) / 2, y: (cH - rH) / 2 })
  }

  const handleCropDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    setIsDragging(true)
    setDragStart({ x: clientX - cropOffset.x, y: clientY - cropOffset.y })
  }

  const handleCropDragMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging) return
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    const container = cropContainerRef.current
    if (!container) return
    const cW = container.clientWidth
    const cH = container.clientHeight
    const newX = clientX - dragStart.x
    const newY = clientY - dragStart.y
    setCropOffset({
      x: Math.min(0, Math.max(newX, cW - renderedImgSize.w)),
      y: Math.min(0, Math.max(newY, cH - renderedImgSize.h)),
    })
  }

  const cropAndReupload = async (): Promise<string> => {
    const img = cropImgRef.current
    const container = cropContainerRef.current
    if (!img || !container || !avatarUrl || renderedImgSize.w === 0) return avatarUrl
    const cW = container.clientWidth
    const cH = container.clientHeight
    const scaleX = img.naturalWidth / renderedImgSize.w
    const scaleY = img.naturalHeight / renderedImgSize.h
    const srcX = -cropOffset.x * scaleX
    const srcY = -cropOffset.y * scaleY
    const srcW = cW * scaleX
    const srcH = cH * scaleY
    const OUTPUT = 600
    const canvas = document.createElement('canvas')
    canvas.width = OUTPUT; canvas.height = OUTPUT
    try {
      canvas.getContext('2d')!.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, OUTPUT, OUTPUT)
    } catch {
      // Canvas tainted (CORS) — skip re-crop, use the already-uploaded image
      return avatarUrl
    }
    return new Promise(resolve => {
      canvas.toBlob(async blob => {
        if (!blob) { resolve(avatarUrl); return }
        const path = `${currentUser!.id}/avatar.jpg`
        const { error } = await supabase.storage.from('avatars').upload(path, blob, { upsert: true, contentType: 'image/jpeg' })
        if (error) { resolve(avatarUrl); return }
        const { data } = supabase.storage.from('avatars').getPublicUrl(path)
        resolve(`${data.publicUrl}?t=${Date.now()}`)
      }, 'image/jpeg', 0.92)
    })
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingAvatar(true)
    setError('')
    let blob: Blob
    try {
      blob = await resizeImage(file)
    } catch {
      setError('Could not process image')
      setUploadingAvatar(false)
      return
    }
    // Screen image for explicit content before uploading
    try {
      const img = await blobToImg(blob)
      const { flagged, reason } = await moderateImage(img)
      if (flagged) {
        setError(`This image was rejected: ${reason ?? 'inappropriate content'}. Please use a different photo.`)
        setUploadingAvatar(false)
        return
      }
    } catch { /* if model fails to load, allow upload */ }
    const userId = currentUser!.id
    const path = `${userId}/avatar.jpg`
    const { error: uploadErr } = await supabase.storage
      .from('avatars')
      .upload(path, blob, { upsert: true, contentType: 'image/jpeg' })
    if (uploadErr) { setError('Upload failed: ' + uploadErr.message); setUploadingAvatar(false); return }
    const { data } = supabase.storage.from('avatars').getPublicUrl(path)
    setAvatarUrl(`${data.publicUrl}?t=${Date.now()}`)
    setCropMode(true)
    setCropOffset({ x: 0, y: 0 })
    setRenderedImgSize({ w: 0, h: 0 })
    setUploadingAvatar(false)
    if (avatarFileRef.current) avatarFileRef.current.value = ''
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!displayName.trim()) { setError('Display name is required'); return }
    if (instruments.length === 0) { setError('Select at least one instrument'); return }
    if (locationPrecision !== 'hidden' && (lat === null || lng === null)) { setError('Please set your location'); return }

    // Moderate text fields before saving
    try {
      const modRes = await fetch('/api/moderate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texts: [displayName.trim(), bio.trim(), gear.join(' ')] }),
      })
      if (modRes.ok) {
        const mod = await modRes.json()
        if (mod.flagged) {
          setError('Your profile contains content that violates our community guidelines. Please revise and try again.')
          return
        }
      }
    } catch { /* if moderation service is down, allow save */ }

    setSaving(true)

    let finalAvatarUrl = avatarUrl
    if (cropMode && avatarUrl && !isAdminMode) {
      finalAvatarUrl = await cropAndReupload()
      setAvatarUrl(finalAvatarUrl)
      setCropMode(false)
    }

    let saveLat = lat ?? 0
    let saveLng = lng ?? 0
    if (locationPrecision === 'hidden') {
      saveLat = 0; saveLng = 0
    } else {
      saveLat = roundCoord(saveLat)
      saveLng = roundCoord(saveLng)
    }

    if (isAdminMode && adminTarget) {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`/api/admin/profile/${adminTarget.id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${session?.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          display_name: displayName.trim(),
          bio: bio.trim(),
          instruments,
          genres,
          contact_email: contactEmail.trim(),
          lat: saveLat,
          lng: saveLng,
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
        lat: saveLat,
        lng: saveLng,
        locationName,
        lookingFor: lookingFor.join(', '),
        level,
        locationPrecision,
        primaryInstrument: primaryInstrument || undefined,
        gear,
        availability,
        avatarUrl: finalAvatarUrl || undefined,
        offersLessons: lookingFor.includes('Students'),
        websiteUrl: normalizeUrl(websiteUrl) || undefined,
        instagramUrl: normalizeInstagram(instagramUrl) || undefined,
        youtubeUrl: normalizeUrl(youtubeUrl) || undefined,
        soundcloudUrl: normalizeUrl(soundcloudUrl) || undefined,
        bandcampUrl: normalizeUrl(bandcampUrl) || undefined,
        tiktokUrl: normalizeTiktok(tiktokUrl) || undefined,
        discordUrl: normalizeDiscord(discordUrl) || undefined,
        audioUrl: audioUrl || undefined,
      })
    }

    setSaving(false)
    onClose()
  }

  const handleRemove = async () => { await removeProfile(); onClose() }
  const handleDeleteAccount = async () => { await deleteAccount(); onClose() }
  const handleChangePassword = async () => {
    setPasswordError('')
    if (newPassword.length < 6) { setPasswordError('Password must be at least 6 characters.'); return }
    if (newPassword !== confirmPassword) { setPasswordError('Passwords do not match.'); return }
    setPasswordSaving(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setPasswordSaving(false)
    if (error) { setPasswordError(error.message); return }
    setNewPassword(''); setConfirmPassword(''); setShowChangePassword(false)
    useStore.getState().showToast('Password updated')
  }

  // ── Admin mode: compact modal dialog ────────────────────────────────────
  if (isAdminMode) {
    return (
      <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
        <div className="modal-box">
          <div className="sticky top-0 bg-ground flex items-center justify-between px-6 pt-5 pb-3 border-b-2 border-ink z-10">
            <div>
              <h2 className="text-[20px] font-extrabold text-ink">
                Admin: {source ? 'Edit Profile' : 'No Profile'}
              </h2>
              {adminTarget && (
                <p className="text-[12px] text-accent-700 mt-0.5 font-bold">Editing {adminTarget.displayName}</p>
              )}
            </div>
            <button onClick={onClose} className="w-9 h-9 border-2 border-ink flex items-center justify-center hover:bg-accent-100 transition-colors">
              <X size={16} />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            <div>
              <Label>Display Name</Label>
              <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)} className="w-full h-12 bg-white border-2 border-ink px-3 text-[15px] focus:outline-none" />
            </div>
            <div>
              <Label>Bio</Label>
              <textarea value={bio} onChange={e => setBio(e.target.value)} rows={3} className="w-full bg-white border-2 border-ink px-3 py-2 text-[15px] focus:outline-none resize-none" />
            </div>
            <div>
              <Label>Instruments</Label>
              <TagPicker options={INSTRUMENT_OPTIONS} selected={instruments} onChange={setInstruments} />
            </div>
            <div>
              <Label>Genres</Label>
              <TagPicker options={GENRE_OPTIONS} selected={genres} onChange={setGenres} />
            </div>
            <div>
              <Label>Looking for</Label>
              <TagPicker options={LOOKING_FOR_OPTIONS} selected={lookingFor} onChange={setLookingFor} />
            </div>
            <div>
              <Label>Contact Email</Label>
              <input type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} className="w-full h-12 bg-white border-2 border-ink px-3 text-[15px] focus:outline-none" />
            </div>
            <div>
              <Label>Location</Label>
              <div className="relative">
                <input
                  type="text"
                  value={locationQuery}
                  onChange={e => handleLocationInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Escape') setShowSuggestions(false) }}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                  className="w-full h-12 bg-white border-2 border-ink px-3 text-[15px] focus:outline-none"
                  placeholder="City, zip code, or address…"
                />
                {showSuggestions && (
                  <div className="absolute left-0 right-0 bg-white border-2 border-ink border-t-0 z-10 shadow-md">
                    {suggestions.map((s, i) => (
                      <button key={i} type="button" onPointerDown={e => { e.preventDefault(); pickSuggestion(s) }}
                        className="w-full text-left px-3 py-2.5 text-[13px] border-t border-neutral-200 first:border-t-0 hover:bg-accent-100 text-ink truncate">
                        {s.display}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {geoStatus === 'error' && <p className="text-[12px] text-accent-700 mt-1">Location not found.</p>}
              {lat !== null && lng !== null && !isNaN(lat) && !isNaN(lng) && (
                <LocationPinMap lat={lat} lng={lng} onChange={(newLat, newLng) => { setLat(newLat); setLng(newLng); setLocationChanged(true) }} onAddress={(display, locName) => { setLocationQuery(display); setLocationName(locName) }} />
              )}
            </div>
            {error && <p className="text-[13px] text-accent-700 bg-accent-100 border-2 border-accent px-3 py-2">{error}</p>}
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose} className="flex-1 h-[52px] border-2 border-ink text-[13px] font-bold text-ink hover:bg-accent-100">Cancel</button>
              <button type="submit" disabled={saving} className="flex-1 flex items-center justify-between h-[52px] bg-accent hover:bg-accent-600 disabled:opacity-60 text-white text-[13px] font-bold px-4">
                <span>{saving ? 'Saving…' : 'Save Changes'}</span><span>→</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    )
  }

  // ── User mode: full-screen profile editor ────────────────────────────────
  const locationSection = (
    <div>
      <Label>Location</Label>
      <p className="text-[12px] text-neutral-500 mb-2">Enter a city, zip code, or address. Pick from the suggestions, or drag the pin to adjust. Your exact address is never shown to other users — only an approximate location.</p>
      <div className="relative flex gap-2 mb-1">
        <div className="relative flex-1">
          <input
            type="text"
            value={locationQuery}
            onChange={e => handleLocationInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Escape') setShowSuggestions(false) }}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            className="w-full h-10 bg-white border-2 border-ink px-2 text-[14px] text-ink focus:outline-none"
            placeholder="City, zip code, or address…"
          />
          {showSuggestions && (
            <div className="absolute left-0 right-0 bg-white border-2 border-ink border-t-0 z-10 shadow-md">
              {suggestions.map((s, i) => (
                <button key={i} type="button" onPointerDown={e => { e.preventDefault(); pickSuggestion(s) }}
                  className="w-full text-left px-3 py-2 text-[13px] border-t border-neutral-200 first:border-t-0 hover:bg-accent-100 text-ink truncate">
                  {s.display}
                </button>
              ))}
            </div>
          )}
        </div>
        <button type="button" onClick={detectLocation} title="Use my current location"
          className="w-10 h-10 border-2 border-ink flex items-center justify-center hover:bg-accent-100 transition-colors flex-shrink-0">
          <Navigation size={14} />
        </button>
      </div>
      {geoStatus === 'searching' && <p className="text-[12px] text-neutral-500">Detecting…</p>}
      {geoStatus === 'error' && <p className="text-[12px] text-accent-700">Not found. Try a more specific address.</p>}
      {lat !== null && lng !== null && !isNaN(lat) && !isNaN(lng) && (
        <LocationPinMap lat={lat} lng={lng} onChange={(newLat, newLng) => { setLat(newLat); setLng(newLng); setLocationChanged(true) }} onAddress={(display, locName) => { setLocationQuery(display); setLocationName(locName) }} />
      )}
    </div>
  )

  const precisionSection = (
    <div>
      <Label>Location precision</Label>
      <div className="border-2 border-ink">
        {(
          [
            { value: 'area' as Precision, label: 'City / zip area', desc: 'Shown within ~1 km of your location' },
            { value: 'hidden' as Precision, label: 'Hidden from map', desc: 'Browse without appearing' },
          ] as const
        ).map((opt, i) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setLocationPrecision(opt.value)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
              i > 0 ? 'border-t-2 border-ink' : ''
            } ${locationPrecision === opt.value ? 'bg-ink text-white' : 'hover:bg-accent-100 text-ink'}`}
          >
            <div className={`w-4 h-4 border-2 rounded-full flex-shrink-0 flex items-center justify-center ${
              locationPrecision === opt.value ? 'border-white' : 'border-ink'
            }`}>
              {locationPrecision === opt.value && <div className="w-2 h-2 bg-white rounded-full" />}
            </div>
            <div>
              <div className="text-[13px] font-extrabold leading-tight">{opt.label}</div>
              <div className={`text-[11px] ${locationPrecision === opt.value ? 'text-white/80' : 'text-neutral-700'}`}>{opt.desc}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )

  const availabilitySection = (
    <div>
      <Label>Availability</Label>
      <div className="border-2 border-ink overflow-x-auto">
        <div className="min-w-[320px]">
          <div className="grid border-b-2 border-ink" style={{ gridTemplateColumns: '68px repeat(7, 1fr)' }}>
            <div className="h-8 border-r-2 border-ink" />
            {DAYS.map(d => (
              <div key={d} className="h-8 text-[10px] font-extrabold text-center flex items-center justify-center border-l-2 border-ink">
                {d}
              </div>
            ))}
          </div>
          {SLOTS.map((slot, si) => (
            <div
              key={slot}
              className={`grid ${si > 0 ? 'border-t-2 border-ink' : ''}`}
              style={{ gridTemplateColumns: '68px repeat(7, 1fr)' }}
            >
              <div className="h-9 text-[10px] font-extrabold flex items-center px-1.5 border-r-2 border-ink leading-tight">
                {slot}
              </div>
              {DAYS.map((_, di) => (
                <button
                  key={di}
                  type="button"
                  onClick={() => toggleAvailability(di, si)}
                  className={`h-9 border-l-2 border-ink transition-colors ${
                    availability[di]?.[si] ? 'bg-accent' : 'hover:bg-accent-100'
                  }`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )

  const gearSection = (
    <div>
      <Label>Gear</Label>
      <div className="flex gap-2 mb-2">
        <input
          type="text"
          value={gearInput}
          onChange={e => setGearInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addGear() } }}
          placeholder="e.g. Fender Stratocaster"
          className="flex-1 h-10 bg-white border-2 border-ink px-2 text-[13px] text-ink focus:outline-none"
        />
        <button type="button" onClick={addGear} className="h-10 px-3 bg-ink text-white text-[12px] font-extrabold hover:bg-neutral-800 transition-colors">
          Add
        </button>
      </div>
      {gear.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {gear.map((item, i) => (
            <span key={i} className="tag flex items-center gap-1.5">
              {item}
              <button
                type="button"
                onClick={() => setGear(g => g.filter((_, j) => j !== i))}
                className="text-neutral-500 hover:text-accent transition-colors leading-none"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )

  const linksSection = (
    <div>
      <Label>Links</Label>
      <div className="space-y-2">
        {([
          { icon: Globe, placeholder: 'Website URL (www.yoursite.com)', value: websiteUrl, onChange: setWebsiteUrl },
          { icon: Instagram, placeholder: 'Instagram (@handle or URL)', value: instagramUrl, onChange: setInstagramUrl },
          { icon: Youtube, placeholder: 'YouTube URL', value: youtubeUrl, onChange: setYoutubeUrl },
          { icon: Music, placeholder: 'SoundCloud URL', value: soundcloudUrl, onChange: setSoundcloudUrl },
          { icon: Tent, placeholder: 'Bandcamp URL', value: bandcampUrl, onChange: setBandcampUrl },
          { icon: Video, placeholder: 'TikTok URL or @handle', value: tiktokUrl, onChange: setTiktokUrl },
          { icon: MessageCircle, placeholder: 'Discord (invite link or username)', value: discordUrl, onChange: setDiscordUrl },
        ] as const).map(({ icon: Icon, placeholder, value, onChange }) => (
          <div key={placeholder} className="relative">
            <Icon size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
            <input
              type="text"
              value={value}
              onChange={e => onChange(e.target.value)}
              placeholder={placeholder}
              className="w-full h-10 bg-white border-2 border-ink pl-8 pr-2 text-[13px] text-ink focus:outline-none"
            />
          </div>
        ))}
      </div>
    </div>
  )

  const audioSection = (
    <div>
      <Label>Audio clip</Label>
      {audioUrl ? (
        <div className="border-2 border-ink p-3 space-y-2">
          <audio controls controlsList="nodownload" src={audioUrl} className="w-full h-8" style={{ colorScheme: 'light' }} />
          <p className="text-[11px] text-neutral-500">Max 20 MB · MP3, WAV, M4A</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => audioFileRef.current?.click()}
              className="flex-1 h-8 border-2 border-ink text-[11px] font-extrabold text-ink hover:bg-accent-100 transition-colors"
            >
              Replace
            </button>
            <button
              type="button"
              onClick={() => setAudioUrl('')}
              className="w-8 h-8 border-2 border-ink flex items-center justify-center text-accent hover:bg-accent-100 transition-colors"
            >
              <Trash2 size={12} />
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => audioFileRef.current?.click()}
          disabled={uploadingAudio}
          className="w-full h-12 border-2 border-ink border-dashed flex items-center justify-center gap-2 text-[12px] font-extrabold text-neutral-500 hover:bg-accent-100 transition-colors disabled:opacity-50"
        >
          <PlayCircle size={16} />
          {uploadingAudio ? 'Uploading…' : 'Upload MP3 / WAV (max 20 MB)'}
        </button>
      )}
    </div>
  )

  return (
    <form onSubmit={handleSubmit} className="fixed inset-0 z-[2000] bg-ground flex flex-col overflow-hidden">
      {/* Hidden file inputs */}
      <input ref={avatarFileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
      <input ref={audioFileRef} type="file" accept="audio/*" className="hidden" onChange={handleAudioUpload} />

      {/* Header */}
      <div
        className="flex-shrink-0 flex items-center gap-4 px-4 lg:px-6 border-b-2 border-ink"
        style={{ minHeight: 68 }}
      >
        <span className="text-[28px] lg:text-[44px] font-extrabold text-ink leading-[0.9] tracking-[-0.02em] flex-shrink-0">
          My profile
        </span>
        {/* Completeness bar — desktop */}
        <div className="hidden lg:flex flex-1 items-center gap-3 min-w-0">
          <div className="flex-1 h-1.5 bg-neutral-300">
            <div
              className="h-full bg-accent transition-all duration-300"
              style={{ width: `${completeness}%` }}
            />
          </div>
          <span className="text-[12px] font-extrabold text-neutral-700 whitespace-nowrap">
            Profile {completeness}% complete
          </span>
        </div>
        <div className="flex items-center gap-2 ml-auto flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="h-[44px] px-4 border-2 border-ink text-[13px] font-extrabold text-ink hover:bg-accent-100 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="h-[44px] min-w-[140px] lg:min-w-[200px] bg-accent hover:bg-accent-600 disabled:opacity-60 text-white font-extrabold text-[13px] flex items-center justify-between px-4 transition-colors"
          >
            <span>{saving ? 'Saving…' : 'Save profile'}</span>
            <span>→</span>
          </button>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto">
        {error && (
          <div className="mx-4 mt-4 text-[13px] text-accent-700 bg-accent-100 border-2 border-accent px-3 py-2">
            {error}
          </div>
        )}

        {/* Desktop: 3-column grid */}
        <div className="hidden lg:grid" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
          {/* Col 1: Photo, name, primary instrument, bio, location */}
          <div className="p-6 space-y-5">
            <div>
              <div
                ref={cropContainerRef}
                className="w-full aspect-square bg-neutral-200 border-2 border-ink relative overflow-hidden group select-none"
                style={{ cursor: cropMode ? (isDragging ? 'grabbing' : 'grab') : 'pointer' }}
                onClick={!cropMode ? () => avatarFileRef.current?.click() : undefined}
                onMouseDown={cropMode && !uploadingAvatar ? handleCropDragStart : undefined}
                onMouseMove={cropMode ? handleCropDragMove : undefined}
                onMouseUp={cropMode ? () => setIsDragging(false) : undefined}
                onMouseLeave={cropMode ? () => setIsDragging(false) : undefined}
                onTouchStart={cropMode && !uploadingAvatar ? handleCropDragStart : undefined}
                onTouchMove={cropMode ? handleCropDragMove : undefined}
                onTouchEnd={cropMode ? () => setIsDragging(false) : undefined}
              >
                {avatarUrl ? (
                  cropMode ? (
                    <>
                      <img
                        ref={cropImgRef}
                        src={avatarUrl}
                        alt="Profile"
                        crossOrigin="anonymous"
                        draggable={false}
                        onLoad={e => initCropSize(e.currentTarget)}
                        style={{
                          position: 'absolute',
                          left: cropOffset.x,
                          top: cropOffset.y,
                          width: renderedImgSize.w || undefined,
                          height: renderedImgSize.h || undefined,
                          maxWidth: 'none',
                          userSelect: 'none',
                          pointerEvents: 'none',
                          visibility: renderedImgSize.w > 0 ? 'visible' : 'hidden',
                        }}
                      />
                      <div className="absolute inset-x-0 bottom-0 h-8 bg-black/60 flex items-center justify-center pointer-events-none">
                        <span className="text-white text-[10px] font-extrabold tracking-widest uppercase">Drag to reposition</span>
                      </div>
                    </>
                  ) : (
                    <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
                  )
                ) : (
                  <div className="flex flex-col items-center justify-center h-full gap-2">
                    <Camera size={28} className="text-neutral-400" />
                    <span className="text-neutral-400 text-[11px] font-extrabold uppercase tracking-widest">Add Photo</span>
                    <span className="text-neutral-400 text-[10px]">Max 5MB</span>
                  </div>
                )}
                {uploadingAvatar && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <span className="text-white text-[12px] font-extrabold">Uploading…</span>
                  </div>
                )}
                {avatarUrl && !cropMode && !uploadingAvatar && (
                  <div className="absolute bottom-0 inset-x-0 h-9 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5">
                    <Camera size={13} className="text-white" />
                    <span className="text-white text-[11px] font-extrabold uppercase tracking-wider">Change Photo</span>
                  </div>
                )}
              </div>
            </div>
            <div>
              <Label>Display / Artist Name</Label>
              <input
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                className="w-full h-12 bg-white border-2 border-ink px-3 text-[15px] text-ink focus:outline-none"
                placeholder="Your name or band name"
              />
            </div>
            <div>
              <Label>Primary instrument</Label>
              <select
                value={primaryInstrument}
                onChange={e => setPrimaryInstrument(e.target.value)}
                className="w-full h-12 bg-white border-2 border-ink px-3 text-[15px] text-ink focus:outline-none"
              >
                <option value="">Select…</option>
                {INSTRUMENT_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </div>
            <div>
              <Label>Bio</Label>
              <textarea
                value={bio}
                onChange={e => setBio(e.target.value)}
                rows={5}
                className="w-full bg-white border-2 border-ink px-3 py-2 text-[15px] text-ink focus:outline-none resize-none"
                placeholder="Tell other musicians about yourself…"
              />
            </div>
            {linksSection}
          </div>

          {/* Col 2: Instruments, genres, level, looking for */}
          <div className="p-6 space-y-5 border-l-2 border-ink">
            <div>
              <Label>Instruments (all that apply)</Label>
              <TagPicker options={INSTRUMENT_OPTIONS} selected={instruments} onChange={setInstruments} />
            </div>
            <div>
              <Label>Genres</Label>
              <TagPicker options={GENRE_OPTIONS} selected={genres} onChange={setGenres} />
            </div>
            <div>
              <Label>Level (optional)</Label>
              <div className="flex border-2 border-ink">
                {LEVEL_OPTIONS.map((opt, i) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setLevel(prev => prev === opt ? undefined : opt)}
                    className={`flex-1 h-10 text-[11px] font-extrabold transition-colors ${
                      i > 0 ? 'border-l-2 border-ink' : ''
                    } ${level === opt ? 'bg-ink text-white' : 'text-ink hover:bg-accent-100'}`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label>Looking for</Label>
              <div className="grid grid-cols-2 gap-y-2.5 gap-x-3">
                {LOOKING_FOR_OPTIONS.map(opt => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setLookingFor(lf => lf.includes(opt) ? lf.filter(x => x !== opt) : [...lf, opt])}
                    className="flex items-start gap-2 text-left"
                  >
                    <div className={`w-5 h-5 flex-shrink-0 border-2 flex items-center justify-center mt-0.5 transition-colors ${
                      opt === 'Students' && lookingFor.includes(opt) ? 'border-[#1d4ed8]' :
                      lookingFor.includes(opt) ? 'bg-accent border-accent' : 'border-ink'
                    }`} style={opt === 'Students' && lookingFor.includes(opt) ? { background: '#1d4ed8' } : undefined}>
                      {lookingFor.includes(opt) && <span className="text-white text-[10px] font-extrabold leading-none">✓</span>}
                    </div>
                    <div>
                      <span className="text-[13px] text-ink leading-tight">{opt}</span>
                      {opt === 'Students' && (
                        <span className="block text-[11px] text-neutral-500 mt-0.5">Your pin will appear blue on the map</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
            {audioSection}
          </div>

          {/* Col 3: Gear, availability, location, precision, account email */}
          <div className="p-6 space-y-5 border-l-2 border-ink">
            {gearSection}
            {availabilitySection}
            {locationSection}
            {precisionSection}
            <div>
              <Label>Account email</Label>
              <div className="h-12 bg-neutral-100 border-2 border-ink px-3 flex items-center text-[14px] text-neutral-500 select-all">
                {currentUser?.email}
              </div>
            </div>
          </div>
        </div>

        {/* Mobile: stacked sections */}
        <div className="lg:hidden flex flex-col">
          <div className="p-4 space-y-4">
            <div className="flex items-center gap-3">
              <div
                className="w-20 h-20 bg-neutral-200 border-2 border-ink relative overflow-hidden cursor-pointer flex-shrink-0"
                onClick={() => avatarFileRef.current?.click()}
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <Camera size={22} className="text-neutral-400" />
                  </div>
                )}
                {uploadingAvatar && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <span className="text-white text-[9px] font-extrabold">…</span>
                  </div>
                )}
              </div>
              <div>
                <p className="text-[12px] font-extrabold text-ink uppercase tracking-widest mb-1">Profile Photo</p>
                <button
                  type="button"
                  onClick={() => avatarFileRef.current?.click()}
                  className="text-[12px] font-bold text-accent-700 hover:underline"
                >
                  {avatarUrl ? 'Change photo' : 'Add photo'}
                </button>
                <p className="text-[10px] text-neutral-400 mt-0.5">Max 5MB · JPG, PNG, GIF</p>
              </div>
            </div>
            <div>
              <Label>Display / Artist Name</Label>
              <input
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                className="w-full h-12 bg-white border-2 border-ink px-3 text-[15px] text-ink focus:outline-none"
                placeholder="Your name or band name"
              />
            </div>
            <div>
              <Label>Primary instrument</Label>
              <select
                value={primaryInstrument}
                onChange={e => setPrimaryInstrument(e.target.value)}
                className="w-full h-12 bg-white border-2 border-ink px-3 text-[15px] text-ink focus:outline-none"
              >
                <option value="">Select…</option>
                {INSTRUMENT_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </div>
            <div>
              <Label>Bio</Label>
              <textarea
                value={bio}
                onChange={e => setBio(e.target.value)}
                rows={4}
                className="w-full bg-white border-2 border-ink px-3 py-2 text-[15px] text-ink focus:outline-none resize-none"
                placeholder="Tell other musicians about yourself…"
              />
            </div>
            {linksSection}
          </div>

          <div className="p-4 space-y-4 border-t-2 border-ink">
            <div>
              <Label>Instruments (all that apply)</Label>
              <TagPicker options={INSTRUMENT_OPTIONS} selected={instruments} onChange={setInstruments} />
            </div>
            <div>
              <Label>Genres</Label>
              <TagPicker options={GENRE_OPTIONS} selected={genres} onChange={setGenres} />
            </div>
            <div>
              <Label>Level (optional)</Label>
              <div className="flex border-2 border-ink">
                {LEVEL_OPTIONS.map((opt, i) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setLevel(prev => prev === opt ? undefined : opt)}
                    className={`flex-1 h-10 text-[11px] font-extrabold transition-colors ${
                      i > 0 ? 'border-l-2 border-ink' : ''
                    } ${level === opt ? 'bg-ink text-white' : 'text-ink hover:bg-accent-100'}`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label>Looking for</Label>
              <div className="grid grid-cols-2 gap-y-2.5 gap-x-3">
                {LOOKING_FOR_OPTIONS.map(opt => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setLookingFor(lf => lf.includes(opt) ? lf.filter(x => x !== opt) : [...lf, opt])}
                    className="flex items-start gap-2 text-left"
                  >
                    <div className={`w-5 h-5 flex-shrink-0 border-2 flex items-center justify-center mt-0.5 transition-colors ${
                      opt === 'Students' && lookingFor.includes(opt) ? 'border-[#1d4ed8]' :
                      lookingFor.includes(opt) ? 'bg-accent border-accent' : 'border-ink'
                    }`} style={opt === 'Students' && lookingFor.includes(opt) ? { background: '#1d4ed8' } : undefined}>
                      {lookingFor.includes(opt) && <span className="text-white text-[10px] font-extrabold leading-none">✓</span>}
                    </div>
                    <div>
                      <span className="text-[13px] text-ink leading-tight">{opt}</span>
                      {opt === 'Students' && (
                        <span className="block text-[11px] text-neutral-500 mt-0.5">Your pin will appear blue on the map</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
            {audioSection}
          </div>

          <div className="p-4 space-y-4 border-t-2 border-ink">
            {gearSection}
            {availabilitySection}
            {locationSection}
            {precisionSection}
            <div>
              <Label>Account email</Label>
              <div className="h-12 bg-neutral-100 border-2 border-ink px-3 flex items-center text-[14px] text-neutral-500">
                {currentUser?.email}
              </div>
            </div>
          </div>
        </div>

        {/* Change password */}
        {!isAdminMode && (
          <div className="border-t-2 border-ink px-4 lg:px-6 py-4">
            {!showChangePassword ? (
              <button
                type="button"
                onClick={() => setShowChangePassword(true)}
                className="flex items-center gap-2 py-2 px-4 text-[13px] text-ink hover:bg-accent-100 transition-colors"
              >
                <KeyRound size={14} />
                Change password
              </button>
            ) : (
              <div className="border-2 border-ink p-4 space-y-3 max-w-sm">
                <p className="text-[14px] font-extrabold text-ink">Change password</p>
                <input
                  type="password"
                  placeholder="New password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="w-full h-10 border-2 border-ink px-3 text-[14px] bg-ground text-ink placeholder:text-neutral-400"
                />
                <input
                  type="password"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  className="w-full h-10 border-2 border-ink px-3 text-[14px] bg-ground text-ink placeholder:text-neutral-400"
                />
                {passwordError && <p className="text-[12px] text-accent-700 font-semibold">{passwordError}</p>}
                <div className="flex gap-2">
                  <button type="button" onClick={() => { setShowChangePassword(false); setNewPassword(''); setConfirmPassword(''); setPasswordError('') }} className="flex-1 h-10 border-2 border-ink text-[13px] font-bold text-ink hover:bg-accent-100">Cancel</button>
                  <button type="button" onClick={handleChangePassword} disabled={passwordSaving} className="flex-1 h-10 bg-accent hover:bg-accent-600 disabled:opacity-50 text-white font-bold text-[13px]">
                    {passwordSaving ? 'Saving…' : 'Update'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Dangerous actions */}
        {source && (
          <div className="border-t-2 border-ink px-4 lg:px-6 py-4">
            {!confirmRemove ? (
              <button
                type="button"
                onClick={() => setConfirmRemove(true)}
                className="py-2 px-4 text-[13px] text-accent-700 hover:bg-accent-100 transition-colors"
              >
                Remove my profile from the map
              </button>
            ) : (
              <div className="border-2 border-ink p-4 space-y-3 bg-accent-100 max-w-sm">
                <p className="text-[14px] text-accent-700 font-extrabold">Remove your pin from the map?</p>
                <p className="text-[12px] text-neutral-700">Your account stays active — you can add a profile again any time.</p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setConfirmRemove(false)} className="flex-1 h-10 border-2 border-ink text-[13px] font-bold text-ink hover:bg-accent-100">Cancel</button>
                  <button type="button" onClick={handleRemove} className="flex-1 h-10 bg-accent hover:bg-accent-600 text-white font-bold text-[13px]">Yes, remove me</button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="border-t-2 border-ink px-4 lg:px-6 py-4">
          {!confirmDelete ? (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="py-2 px-4 text-[13px] text-neutral-500 hover:text-accent-700 hover:bg-accent-100 transition-colors"
            >
              Delete my account permanently
            </button>
          ) : (
            <div className="border-2 border-ink p-4 space-y-3 bg-accent-100 max-w-sm">
              <p className="text-[14px] text-accent-700 font-extrabold">Delete account permanently?</p>
              <p className="text-[12px] text-neutral-700">This cannot be undone. Your profile, map pin and account will be deleted.</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => setConfirmDelete(false)} className="flex-1 h-10 border-2 border-ink text-[13px] font-bold text-ink hover:bg-accent-100">Cancel</button>
                <button type="button" onClick={handleDeleteAccount} className="flex-1 h-10 bg-accent hover:bg-accent-600 text-white font-bold text-[13px]">Delete Everything</button>
              </div>
            </div>
          )}
        </div>

        <div className="h-8" />
      </div>
    </form>
  )
}
