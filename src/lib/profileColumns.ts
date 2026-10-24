// Columns of public.profiles that are safe for anyone to read.
// Always select these explicitly; never select('*') on profiles.
// Private contact details (contact_email, phone) live in public.profile_contacts.
export const PUBLIC_PROFILE_COLUMNS = [
  'id', 'display_name', 'bio', 'instruments', 'genres', 'lat', 'lng',
  'location_name', 'looking_for', 'avatar_url', 'created_at', 'last_seen_at',
  'location_precision', 'neighborhood', 'level', 'primary_instrument', 'gear',
  'availability', 'years_playing', 'is_test', 'offers_lessons',
  'website_url', 'instagram_url', 'youtube_url', 'soundcloud_url',
  'bandcamp_url', 'tiktok_url', 'discord_url', 'audio_url',
].join(', ')
