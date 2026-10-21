import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import { useStore } from '../store'
import type { Musician } from '../types'
import { getInstrumentCode } from '../lib/musicianUtils'

function makeMusicianPin(musician: Musician, isSelected: boolean) {
  const code = getInstrumentCode(musician.instruments)
  const firstName = musician.displayName.split(' ')[0]
  return new L.DivIcon({
    className: '',
    html: `<div class="mf-pin${isSelected ? ' is-selected' : ''}"><b>${code}</b> <span>${firstName}</span></div>`,
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

function MapClickHandler() {
  const { setSelectedId } = useStore()
  useMapEvents({
    click: () => setSelectedId(null),
  })
  return null
}

export default function MusicianMap() {
  const { filteredMusicians, selectedId, setSelectedId } = useStore()
  const musicians = filteredMusicians()

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

        {musicians.filter(m => !isNaN(m.lat) && !isNaN(m.lng)).map(musician => (
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

        <FlyToUser musicians={musicians} />
        <MapClickHandler />
      </MapContainer>

      {/* Map hint overlay */}
      <div className="absolute top-3 left-3 z-[999] bg-ink text-white text-[12px] font-semibold px-2.5 py-1.5 pointer-events-none">
        Click a pin or a name
      </div>
    </div>
  )
}
