export type TransportMode = 'car' | 'public' | 'walking'
export type GroupType = 'solo' | 'couple' | 'family' | 'friends'
export type TripStatus = 'planning' | 'active' | 'completed'
export type ActivityCategory = 'attraction' | 'restaurant' | 'cafe' | 'museum' | 'park' | 'hotel' | 'transport' | 'other'
export type AccommodationType = 'hotel' | 'apartment' | 'hostel' | 'friends' | 'airbnb'

export const ACCOMMODATION_TYPE_OPTIONS: { value: AccommodationType; label: string; emoji: string }[] = [
  { value: 'hotel', label: 'Hotel', emoji: '🏨' },
  { value: 'apartment', label: 'Apartment', emoji: '🏠' },
  { value: 'airbnb', label: 'Airbnb', emoji: '🛋️' },
  { value: 'hostel', label: 'Hostel', emoji: '🛏️' },
  { value: 'friends', label: "Friend's place", emoji: '🤝' },
]

export const FOOD_PREFERENCE_OPTIONS = [
  { value: 'local_cuisine', label: 'Local Cuisine', emoji: '🍽️' },
  { value: 'street_food', label: 'Street Food', emoji: '🌮' },
  { value: 'fine_dining', label: 'Fine Dining', emoji: '🥂' },
  { value: 'seafood', label: 'Seafood', emoji: '🦞' },
  { value: 'asian', label: 'Asian', emoji: '🍜' },
  { value: 'italian', label: 'Italian', emoji: '🍕' },
  { value: 'middle_eastern', label: 'Middle Eastern', emoji: '🧆' },
  { value: 'cafes', label: 'Cafes & Coffee', emoji: '☕' },
  { value: 'bakeries', label: 'Bakeries', emoji: '🥐' },
  { value: 'cocktail_bars', label: 'Cocktail Bars', emoji: '🍸' },
] as const

export const DIETARY_RESTRICTION_OPTIONS = [
  { value: 'vegetarian', label: 'Vegetarian', emoji: '🥗' },
  { value: 'vegan', label: 'Vegan', emoji: '🌱' },
  { value: 'gluten_free', label: 'Gluten-Free', emoji: '🌾' },
  { value: 'halal', label: 'Halal', emoji: '☪️' },
  { value: 'kosher', label: 'Kosher', emoji: '✡️' },
  { value: 'dairy_free', label: 'Dairy-Free', emoji: '🥛' },
  { value: 'nut_allergy', label: 'Nut Allergy', emoji: '🥜' },
  { value: 'shellfish_allergy', label: 'No Shellfish', emoji: '🦐' },
] as const

export const INTEREST_OPTIONS = [
  { value: 'foodie', label: 'Foodie', emoji: '🍜' },
  { value: 'history', label: 'History', emoji: '🏛️' },
  { value: 'nightlife', label: 'Nightlife', emoji: '🎉' },
  { value: 'nature', label: 'Nature', emoji: '🌿' },
  { value: 'art', label: 'Art & Culture', emoji: '🎨' },
  { value: 'shopping', label: 'Shopping', emoji: '🛍️' },
  { value: 'beaches', label: 'Beaches', emoji: '🏖️' },
  { value: 'adventure', label: 'Adventure', emoji: '🧗' },
  { value: 'wellness', label: 'Wellness', emoji: '🧘' },
  { value: 'family', label: 'Family-friendly', emoji: '👨‍👩‍👧‍👦' },
] as const

export const TRANSPORT_OPTIONS = [
  { value: 'public', label: 'Public Transport', emoji: '🚇' },
  { value: 'car', label: 'Car / Taxi', emoji: '🚗' },
  { value: 'walking', label: 'Walking', emoji: '🚶' },
] as const

export const GROUP_TYPE_OPTIONS = [
  { value: 'solo', label: 'Solo', emoji: '🧍' },
  { value: 'couple', label: 'Couple', emoji: '👫' },
  { value: 'family', label: 'Family', emoji: '👨‍👩‍👧‍👦' },
  { value: 'friends', label: 'Friends', emoji: '👯' },
] as const

export interface Trip {
  id: string
  userId: string
  title: string
  destination: string
  lat: number | null
  lng: number | null
  startDate: string
  endDate: string
  hotelAddress: string | null
  hotelLat: number | null
  hotelLng: number | null
  accommodationType: AccommodationType | null
  transport: TransportMode
  groupType: GroupType
  groupSize: number
  childAges: number[]
  interests: string[]
  foodPreferences: string[]
  dietaryRestrictions: string[]
  notes: string | null
  status: TripStatus
  createdAt: string
  updatedAt: string
  activities?: Activity[]
}

export interface Activity {
  id: string
  tripId: string
  placeId: string | null
  name: string
  address: string | null
  lat: number | null
  lng: number | null
  category: ActivityCategory
  scheduledAt: string | null
  durationMins: number | null
  notes: string | null
  groupLabel: string | null
  visited: boolean
  aiGenerated: boolean
  sortOrder: number
  memory?: string | null
  memoryEmoji?: string | null
  createdAt: string
  updatedAt: string
}

export interface WeatherDay {
  date: string
  maxTemp: number
  minTemp: number
  weatherCode: number
  description: string
  emoji: string
}

export function weatherCodeToInfo(code: number): { description: string; emoji: string } {
  if (code === 0) return { description: 'Clear sky', emoji: '☀️' }
  if (code <= 3) return { description: 'Partly cloudy', emoji: '⛅' }
  if (code <= 48) return { description: 'Foggy', emoji: '🌫️' }
  if (code <= 67) return { description: 'Rainy', emoji: '🌧️' }
  if (code <= 77) return { description: 'Snowy', emoji: '❄️' }
  if (code <= 82) return { description: 'Showers', emoji: '🌦️' }
  if (code <= 99) return { description: 'Thunderstorm', emoji: '⛈️' }
  return { description: 'Unknown', emoji: '🌡️' }
}
