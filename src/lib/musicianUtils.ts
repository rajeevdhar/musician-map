export const INSTRUMENT_CODES: Record<string, string> = {
  'Guitar': 'GT',
  'Bass': 'BA',
  'Drums': 'DR',
  'Keyboard / Piano': 'KY',
  'Vocals': 'VO',
  'Violin': 'VN',
  'Trumpet': 'TR',
  'Saxophone': 'SX',
  'Cello': 'CE',
  'Flute': 'FL',
  'Banjo': 'BJ',
  'Ukulele': 'UK',
  'Mandolin': 'MN',
  'Harmonica': 'HR',
  'Synthesizer': 'SY',
  'DJ / Producer': 'DJ',
  'Other': 'OT',
}

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function getInstrumentCode(instruments: string[]): string {
  if (!instruments.length) return 'MU'
  return INSTRUMENT_CODES[instruments[0]] ?? instruments[0].slice(0, 2).toUpperCase()
}

export function shortLocation(locationName: string): string {
  const parts = locationName.split(',').map(s => s.trim())
  const first = parts[0] ?? ''
  return /^\d{5}(-\d{4})?$/.test(first) ? (parts[1] ?? first) : first
}

export function haversineDistanceMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3959
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function formatDistance(miles: number): string {
  if (miles < 1) return '<1 mi'
  if (miles < 10) return `${miles.toFixed(1)} mi`
  return `${Math.round(miles)} mi`
}
