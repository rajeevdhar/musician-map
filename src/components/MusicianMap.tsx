import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import { useStore } from '../store'
import type { Musician } from '../types'
import MapLegend from './MapLegend'
import { isOnline } from '../lib/presence'

// Custom DivIcon factories
function makeMusicianIcon(online = false) {
  return new L.DivIcon({
    className: '',
    html: `<div class="musician-pin">🎵${online ? '<span class="online-badge" title="Online now"></span>' : ''}</div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -20],
  })
}

const musicianIcon = makeMusicianIcon()
const musicianOnlineIcon = makeMusicianIcon(true)

// Mini popup card for musician pin
function MusicianPopup({ musician, onExpand }: { musician: Musician; onExpand: () => void }) {
  return (
    <div className="p-3 min-w-[200px]">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-2xl">🎵</span>
        <div>
          <p className="font-semibold text-gray-900 text-sm leading-tight flex items-center gap-1.5">
            {musician.displayName}
            {isOnline(musician.lastSeenAt) && (
              <span className="flex items-center gap-1 text-[10px] text-green-600 font-medium">
                <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                Online
              </span>
            )}
          </p>
          <p className="text-xs text-gray-500">{musician.locationName}</p>
        </div>
      </div>
      {musician.instruments.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {musician.instruments.slice(0, 3).map(i => (
            <span key={i} className="bg-indigo-50 text-indigo-700 text-[10px] px-2 py-0.5 rounded-full font-medium">{i}</span>
          ))}
          {musician.instruments.length > 3 && (
            <span className="text-[10px] text-gray-400">+{musician.instruments.length - 3} more</span>
          )}
        </div>
      )}
      <button
        onClick={onExpand}
        className="mt-2 w-full text-xs text-center text-indigo-600 font-medium hover:underline"
      >
        View Profile →
      </button>
    </div>
  )
}

// Fly to the newly added musician's location
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

interface Props {
  onMusicianClick: (m: Musician) => void
}

export default function MusicianMap({ onMusicianClick }: Props) {
  const { musicians } = useStore()

  const defaultCenter: [number, number] = [39.8283, -98.5795] // US center
  const defaultZoom = 5

  return (
    <div className="absolute inset-0">
      <MapContainer
        center={defaultCenter}
        zoom={defaultZoom}
        zoomControl={false}
        className="w-full h-full"
        style={{ background: '#e8e0d8' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Musician markers */}
        {musicians.filter(m => !isNaN(m.lat) && !isNaN(m.lng)).map(musician => (
          <Marker key={musician.id} position={[musician.lat, musician.lng]} icon={isOnline(musician.lastSeenAt) ? musicianOnlineIcon : musicianIcon}>
            <Popup minWidth={220} maxWidth={280}>
              <MusicianPopup musician={musician} onExpand={() => onMusicianClick(musician)} />
            </Popup>
          </Marker>
        ))}

        <FlyToUser musicians={musicians} />
      </MapContainer>

      <MapLegend />
    </div>
  )
}
