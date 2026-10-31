import { useEffect, useRef } from 'react'
import L from 'leaflet'
import { STATE_ABBR } from '../lib/musicianUtils'

// Extract "City, ST" (US) or "City, Country" (non-US) from a Nominatim address object
export function nominatimCityState(addr: Record<string, string>): string {
  const city = addr.city ?? addr.town ?? addr.village ?? addr.hamlet ?? addr.suburb ?? ''
  const state = addr.state ? (STATE_ABBR[addr.state] ?? addr.state) : ''
  if (city && state) return `${city}, ${state}`
  return city || state || ''
}

function nominatimDisplay(addr: Record<string, string>, fallback: string): string {
  const city = addr.city ?? addr.town ?? addr.village ?? addr.hamlet ?? addr.suburb ?? ''
  const isUS = addr.country_code === 'us'
  const state = isUS && addr.state ? (STATE_ABBR[addr.state] ?? addr.state) : ''
  const country = !isUS ? (addr.country ?? '') : ''
  const parts = [city, state || country].filter(Boolean)
  return parts.length ? parts.join(', ') : fallback.split(',').slice(0, 2).join(', ')
}

export type Suggestion = { lat: number; lng: number; display: string; locationName: string }

export async function fetchSuggestions(query: string): Promise<Suggestion[]> {
  if (query.length < 3) return []
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=1`
    const res = await fetch(url, { headers: { 'User-Agent': 'MusicianMap/1.0' } })
    const data = await res.json() as Array<{ lat: string; lon: string; display_name: string; address?: Record<string, string> }>
    return data.map(r => ({
      lat: parseFloat(r.lat),
      lng: parseFloat(r.lon),
      display: r.address ? nominatimDisplay(r.address, r.display_name) : r.display_name.split(',').slice(0, 2).join(', '),
      locationName: r.address ? nominatimCityState(r.address) : r.display_name.split(',').slice(0, 2).join(', '),
    }))
  } catch { return [] }
}

// Draggable pin; areaRadius (metres) also draws the approximate area others see
export default function LocationPinMap({ lat, lng, onChange, onAddress, areaRadius }: {
  lat: number; lng: number
  onChange: (lat: number, lng: number) => void
  onAddress?: (display: string, locationName: string) => void
  areaRadius?: number
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)
  const circleRef = useRef<L.Circle | null>(null)
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
    marker.on('drag', () => circleRef.current?.setLatLng(marker.getLatLng()))
    marker.on('dragend', async () => {
      const pos = marker.getLatLng()
      onChange(pos.lat, pos.lng)
      if (onAddressRef.current) {
        try {
          const url = `https://nominatim.openstreetmap.org/reverse?lat=${pos.lat}&lon=${pos.lng}&format=json&addressdetails=1`
          const res = await fetch(url, { headers: { 'User-Agent': 'MusicianMap/1.0' } })
          const data = await res.json()
          const addr = (data.address ?? {}) as Record<string, string>
          const cityState = nominatimCityState(addr)
          // "12 Grove St, Jersey City, NJ": readable reference for the search field
          const street = [addr.house_number, addr.road].filter(Boolean).join(' ') || addr.neighbourhood || addr.suburb || ''
          const display = [street, cityState].filter(Boolean).join(', ')
            || (data.display_name ?? '').split(',').map((s: string) => s.trim()).slice(0, 3).join(', ')
          onAddressRef.current(display, cityState || display)
        } catch { /* keep existing address on error */ }
      }
    })
    mapRef.current = map
    markerRef.current = marker
    setTimeout(() => { if (mapRef.current) map.invalidateSize() }, 100)
    return () => { map.remove(); mapRef.current = null; markerRef.current = null; circleRef.current = null }
  }, []) // eslint-disable-line

  useEffect(() => {
    const map = mapRef.current
    if (!map || !markerRef.current) return
    circleRef.current?.remove()
    // SVG stroke attributes can't use var(), so read the theme's accent colour
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--color-accent').trim() || '#ec3013'
    circleRef.current = areaRadius
      ? L.circle(markerRef.current.getLatLng(), {
          radius: areaRadius, color: accent, weight: 2, dashArray: '6 4', fillOpacity: 0.12, interactive: false,
        }).addTo(map)
      : null
  }, [areaRadius])

  useEffect(() => {
    if (!mapRef.current || !markerRef.current || isNaN(lat) || isNaN(lng)) return
    const c = mapRef.current.getCenter()
    if (Math.abs(c.lat - lat) < 1e-9 && Math.abs(c.lng - lng) < 1e-9) return
    markerRef.current.setLatLng([lat, lng])
    circleRef.current?.setLatLng([lat, lng])
    mapRef.current.setView([lat, lng], 14, { animate: true, duration: 0.6 })
  }, [lat, lng])

  return <div ref={containerRef} style={{ height: '260px' }} className="border-2 border-ink mt-2" />
}
