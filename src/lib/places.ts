const PLACES_API_BASE = 'https://maps.googleapis.com/maps/api/place'
const MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY!

export interface PlaceResult {
  placeId: string
  name: string
  address: string
  lat: number
  lng: number
  rating?: number
  types: string[]
  photoRef?: string
}

export interface PlaceDetail extends PlaceResult {
  phone?: string
  website?: string
  openNow?: boolean
  openingHours?: string[]
  priceLevel?: number
  countryCode?: string
}

export async function searchPlaces(query: string, lat?: number, lng?: number, destination?: string): Promise<PlaceResult[]> {
  const anchoredQuery = destination ? `${query} in ${destination}` : query
  const params = new URLSearchParams({
    query: anchoredQuery,
    key: MAPS_API_KEY,
    language: 'en',
  })
  if (lat && lng) {
    params.set('location', `${lat},${lng}`)
    params.set('radius', '50000')
  }

  const res = await fetch(`${PLACES_API_BASE}/textsearch/json?${params}`)
  const data = await res.json()

  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    throw new Error(`Places API error: ${data.status}`)
  }

  return (data.results ?? []).slice(0, 8).map((r: PlaceApiResult) => ({
    placeId: r.place_id,
    name: r.name,
    address: r.formatted_address,
    lat: r.geometry.location.lat,
    lng: r.geometry.location.lng,
    rating: r.rating,
    types: r.types,
    photoRef: r.photos?.[0]?.photo_reference,
  }))
}

export async function getPlaceDetail(placeId: string): Promise<PlaceDetail> {
  const params = new URLSearchParams({
    place_id: placeId,
    fields: 'place_id,name,formatted_address,geometry,rating,types,photos,opening_hours,formatted_phone_number,website,price_level,address_components',
    key: MAPS_API_KEY,
    language: 'en',
  })

  const res = await fetch(`${PLACES_API_BASE}/details/json?${params}`)
  const data = await res.json()

  if (data.status !== 'OK') throw new Error(`Place details error: ${data.status}`)

  const r = data.result as PlaceDetailApiResult
  const countryComponent = r.address_components?.find(c => c.types.includes('country'))
  return {
    placeId: r.place_id,
    name: r.name,
    address: r.formatted_address,
    lat: r.geometry.location.lat,
    lng: r.geometry.location.lng,
    rating: r.rating,
    types: r.types,
    photoRef: r.photos?.[0]?.photo_reference,
    phone: r.formatted_phone_number,
    website: r.website,
    openNow: r.opening_hours?.open_now,
    openingHours: r.opening_hours?.weekday_text,
    priceLevel: r.price_level,
    countryCode: countryComponent?.short_name,
  }
}

export function placePhotoUrl(photoRef: string, maxWidth = 400): string {
  return `${PLACES_API_BASE}/photo?maxwidth=${maxWidth}&photoreference=${photoRef}&key=${MAPS_API_KEY}`
}

// Internal types for Google Places API response shapes
interface PlaceApiResult {
  place_id: string
  name: string
  formatted_address: string
  geometry: { location: { lat: number; lng: number } }
  rating?: number
  types: string[]
  photos?: { photo_reference: string }[]
}

interface PlaceDetailApiResult extends PlaceApiResult {
  formatted_phone_number?: string
  website?: string
  opening_hours?: { open_now: boolean; weekday_text: string[] }
  price_level?: number
  address_components?: { types: string[]; short_name: string; long_name: string }[]
}
