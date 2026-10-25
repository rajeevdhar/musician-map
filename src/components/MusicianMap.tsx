import { useEffect } from 'react'
import { MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet.markercluster'
import { useStore } from '../store'
import { isOnline } from '../lib/presence'
import type { Musician } from '../types'

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function makeMusicianPin(musician: Musician, isSelected: boolean) {
  const firstName = musician.displayName.split(' ')[0]
  const isTeacher = musician.offersLessons ?? false
  const online = isOnline(musician.lastSeenAt)

  const city = musician.locationName.split(',')[0]
  const instrumentStr = musician.instruments.slice(0, 2).join(', ')
  const meta = [instrumentStr, musician.level, city].filter(Boolean).join(' · ')
  const bio = musician.bio && musician.bio.length > 72 ? musician.bio.slice(0, 72) + '…' : musician.bio

  const pinClass = ['mf-pin', isSelected ? 'is-selected' : '', isTeacher ? 'is-teacher' : ''].filter(Boolean).join(' ')
  const dot = online ? '<span class="mf-online-dot"></span>' : ''

  const tooltip = `<div class="mf-pin-tooltip">
    <div class="mf-tip-name">${esc(musician.displayName)}${online ? ' <span class="mf-tip-online">● online</span>' : ''}</div>
    ${meta ? `<div class="mf-tip-meta">${esc(meta)}</div>` : ''}
    ${bio ? `<div class="mf-tip-bio">${esc(bio)}</div>` : ''}
    ${isTeacher ? '<div class="mf-tip-teacher">OFFERS LESSONS</div>' : ''}
  </div>`

  return new L.DivIcon({
    className: '',
    html: `<div class="mf-pin-wrap"><div class="${pinClass}">${dot}${esc(firstName)}</div>${tooltip}</div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  })
}

function FlyToUser({ musicians }: { musicians: Musician[] }) {
  const map = useMap()
  const { currentUser } = useStore()

  useEffect(() => {
    if (!currentUser) return
    const profile = musicians.find(m => m.id === currentUser.id)
    if (profile && !isNaN(profile.lat) && !isNaN(profile.lng)) {
      map.flyTo([profile.lat, profile.lng], 13, { duration: 1.5 })
    }
  }, [musicians.length]) // eslint-disable-line

  return null
}

function FlyToSelected({ musicians }: { musicians: Musician[] }) {
  const map = useMap()
  const { selectedId } = useStore()

  useEffect(() => {
    if (!selectedId) return
    const m = musicians.find(m => m.id === selectedId)
    if (m && !isNaN(m.lat) && !isNaN(m.lng)) {
      map.flyTo([m.lat, m.lng], Math.max(map.getZoom(), 11), { duration: 1.2 })
    }
  }, [selectedId]) // eslint-disable-line

  return null
}

function ClusteredMarkers({ musicians, jittered, selectedId, setSelectedId }: {
  musicians: Musician[]
  jittered: Map<string, [number, number]>
  selectedId: string | null
  setSelectedId: (id: string | null) => void
}) {
  const map = useMap()

  useEffect(() => {
    const group = L.markerClusterGroup({
      iconCreateFunction: (cluster) => new L.DivIcon({
        className: '',
        html: `<div class="mf-cluster">${cluster.getChildCount()}</div>`,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      }),
      maxClusterRadius: 50,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      animate: true,
    })

    musicians.forEach(musician => {
      const pos = jittered.get(musician.id) ?? [musician.lat, musician.lng] as [number, number]
      const marker = L.marker(pos, {
        icon: makeMusicianPin(musician, musician.id === selectedId),
        zIndexOffset: musician.id === selectedId ? 1000 : 0,
      })
      marker.on('click', (e: L.LeafletMouseEvent) => {
        e.originalEvent.stopPropagation()
        setSelectedId(musician.id === selectedId ? null : musician.id)
      })
      group.addLayer(marker)
    })

    map.addLayer(group)
    return () => { map.removeLayer(group) }
  }, [musicians, selectedId]) // eslint-disable-line

  return null
}

function MapClickHandler() {
  const { setSelectedId } = useStore()
  useMapEvents({
    click: () => setSelectedId(null),
  })
  return null
}

function jitterPositions(musicians: Musician[]): Map<string, [number, number]> {
  const positions = new Map<string, [number, number]>()
  const groups = new Map<string, Musician[]>()

  for (const m of musicians) {
    const key = `${m.lat},${m.lng}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(m)
  }

  const RADIUS = 0.003 // ~300m

  for (const group of groups.values()) {
    if (group.length === 1) {
      positions.set(group[0].id, [group[0].lat, group[0].lng])
    } else {
      const lat0 = group[0].lat
      const lng0 = group[0].lng
      const lonScale = Math.cos((lat0 * Math.PI) / 180)
      group.forEach((m, i) => {
        const angle = (2 * Math.PI * i) / group.length
        positions.set(m.id, [
          lat0 + RADIUS * Math.sin(angle),
          lng0 + (RADIUS / lonScale) * Math.cos(angle),
        ])
      })
    }
  }

  return positions
}

export default function MusicianMap() {
  const { filteredMusicians, musicians, selectedId, setSelectedId } = useStore()
  const visible = filteredMusicians()
  const validVisible = visible.filter(m => !isNaN(m.lat) && !isNaN(m.lng))
  const jittered = jitterPositions(validVisible)
  const onlineCount = musicians.filter(m => isOnline(m.lastSeenAt)).length

  const defaultCenter: [number, number] = [39.8283, -98.5795]
  const defaultZoom = 5

  return (
    <div className="absolute inset-0" data-tour="map">
      <MapContainer
        center={defaultCenter}
        zoom={defaultZoom}
        zoomControl={true}
        className="w-full h-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />

        <ClusteredMarkers
          musicians={validVisible}
          jittered={jittered}
          selectedId={selectedId}
          setSelectedId={setSelectedId}
        />

        <FlyToUser musicians={visible} />
        <FlyToSelected musicians={visible} />
        <MapClickHandler />
      </MapContainer>

      {/* Map legend */}
      <div className="large-text-zoom absolute bottom-6 left-3 z-[999] bg-ink text-white text-[11px] font-extrabold pointer-events-none space-y-1.5 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className="inline-block w-5 h-3 flex-shrink-0" style={{ background: 'var(--color-accent)' }} />
          <span>Musician</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-5 h-3 flex-shrink-0" style={{ background: '#b45309' }} />
          <span>Offers lessons</span>
        </div>
        {onlineCount > 0 && (
          <div className="flex items-center gap-2 border-t border-white/20 pt-1.5 mt-0.5">
            <span className="inline-block w-2 h-2 rounded-full flex-shrink-0 bg-green-400 flex-shrink-0" />
            <span>{onlineCount} online now</span>
          </div>
        )}
      </div>
    </div>
  )
}
