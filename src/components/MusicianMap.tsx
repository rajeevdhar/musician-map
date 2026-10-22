import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import { useStore } from '../store'
import { isOnline } from '../lib/presence'
import type { Musician } from '../types'

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function makeMusicianPin(musician: Musician, isSelected: boolean) {
  const firstName = musician.displayName.split(' ')[0]
  const isTeacher = musician.offersLessons ?? false

  const city = musician.locationName.split(',')[0]
  const instrumentStr = musician.instruments.slice(0, 2).join(', ')
  const meta = [instrumentStr, musician.level, city].filter(Boolean).join(' · ')
  const bio = musician.bio && musician.bio.length > 72 ? musician.bio.slice(0, 72) + '…' : musician.bio

  const pinClass = ['mf-pin', isSelected ? 'is-selected' : '', isTeacher ? 'is-teacher' : ''].filter(Boolean).join(' ')

  const tooltip = `<div class="mf-pin-tooltip">
    <div class="mf-tip-name">${esc(musician.displayName)}</div>
    ${meta ? `<div class="mf-tip-meta">${esc(meta)}</div>` : ''}
    ${bio ? `<div class="mf-tip-bio">${esc(bio)}</div>` : ''}
    ${isTeacher ? '<div class="mf-tip-teacher">OFFERS LESSONS</div>' : ''}
  </div>`

  return new L.DivIcon({
    className: '',
    html: `<div class="mf-pin-wrap"><div class="${pinClass}">${esc(firstName)}</div>${tooltip}</div>`,
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

function MapClickHandler() {
  const { setSelectedId } = useStore()
  useMapEvents({
    click: () => setSelectedId(null),
  })
  return null
}

export default function MusicianMap() {
  const { filteredMusicians, musicians, selectedId, setSelectedId } = useStore()
  const visible = filteredMusicians()
  const onlineCount = musicians.filter(m => isOnline(m.lastSeenAt)).length

  const defaultCenter: [number, number] = [39.8283, -98.5795]
  const defaultZoom = 5

  return (
    <div className="absolute inset-0">
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

        {visible.filter(m => !isNaN(m.lat) && !isNaN(m.lng)).map(musician => (
          <Marker
            key={musician.id}
            position={[musician.lat, musician.lng]}
            icon={makeMusicianPin(musician, musician.id === selectedId)}
            eventHandlers={{
              click: (e) => {
                e.originalEvent.stopPropagation()
                setSelectedId(musician.id === selectedId ? null : musician.id)
              },
            }}
            zIndexOffset={musician.id === selectedId ? 1000 : 0}
          />
        ))}

        <FlyToUser musicians={visible} />
        <FlyToSelected musicians={visible} />
        <MapClickHandler />
      </MapContainer>

      {/* Map legend */}
      <div className="absolute bottom-6 left-3 z-[999] bg-ink text-white text-[11px] font-semibold pointer-events-none space-y-1.5 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 flex-shrink-0" style={{ background: 'var(--color-accent)' }} />
          <span>Musician</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 flex-shrink-0" style={{ background: '#b45309' }} />
          <span>Offers lessons</span>
        </div>
        {onlineCount > 0 && (
          <div className="flex items-center gap-2 border-t border-white/20 pt-1.5 mt-0.5">
            <span className="inline-block w-2 h-2 rounded-full flex-shrink-0 bg-green-400" />
            <span>{onlineCount} online now</span>
          </div>
        )}
      </div>
    </div>
  )
}
