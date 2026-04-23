'use client'

import { useState, useEffect, useCallback } from 'react'
import { Zap, Loader2, MapPin, Clock, Plus, Navigation } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Trip } from '@/types'
import { NearbyRecommendation } from '@/lib/gemini'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface Props {
  trip: Trip
}

interface GeoLocation {
  lat: number
  lng: number
  accuracy: number
}

// Haversine distance in km
function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

const MAX_DISTANCE_KM = 50

export function LiveModeClient({ trip }: Props) {
  const [location, setLocation] = useState<GeoLocation | null>(null)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [recommendations, setRecommendations] = useState<NearbyRecommendation[]>([])
  const [loading, setLoading] = useState(false)
  const [lastFetched, setLastFetched] = useState<Date | null>(null)
  const [addingRec, setAddingRec] = useState<string | null>(null)

  const [destCoords, setDestCoords] = useState<{ lat: number; lng: number } | null>(
    trip.lat && trip.lng ? { lat: trip.lat, lng: trip.lng } : null
  )

  // Geocode the destination if the trip doesn't have coordinates stored
  useEffect(() => {
    if (destCoords) return
    fetch(`/wayfarer-ai/api/places/search?q=${encodeURIComponent(trip.destination)}&destination=${encodeURIComponent(trip.destination)}`)
      .then(r => r.json())
      .then(data => {
        const first = data.results?.[0]
        if (first?.lat && first?.lng) setDestCoords({ lat: first.lat, lng: first.lng })
      })
      .catch(() => {})
  }, [trip.destination, destCoords])

  const distanceFromDestination = location && destCoords
    ? distanceKm(location.lat, location.lng, destCoords.lat, destCoords.lng)
    : null
  const tooFar = distanceFromDestination !== null && distanceFromDestination > MAX_DISTANCE_KM

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser.')
      return
    }

    const watchId = navigator.geolocation.watchPosition(
      pos => {
        setLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        })
        setLocationError(null)
      },
      () => {
        setLocationError('Location access denied. Please enable location services.')
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    )

    return () => navigator.geolocation.clearWatch(watchId)
  }, [])

  const fetchNearby = useCallback(async () => {
    if (!location) {
      toast.error('Waiting for location…')
      return
    }

    setLoading(true)
    setRecommendations([])

    const now = new Date()
    const localTime = now.toLocaleString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    })

    const visitedToday = (trip.activities ?? [])
      .filter(a => {
        if (!a.visited || !a.scheduledAt) return false
        return new Date(a.scheduledAt).toDateString() === now.toDateString()
      })
      .map(a => a.name)

    try {
      const res = await fetch('/wayfarer-ai/api/ai/nearby', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destination: trip.destination,
          lat: location.lat,
          lng: location.lng,
          localTime,
          groupType: trip.groupType,
          groupSize: trip.groupSize,
          childAges: trip.childAges,
          transport: trip.transport,
          interests: trip.interests,
          foodPreferences: trip.foodPreferences,
          dietaryRestrictions: trip.dietaryRestrictions,
          visitedToday,
        }),
      })
      const data = await res.json()
      if (data.recommendations) {
        setRecommendations(data.recommendations)
        setLastFetched(new Date())
      } else {
        throw new Error('No recommendations')
      }
    } catch (error) {
      console.error(error)
      toast.error('Could not get recommendations. Try again.')
    } finally {
      setLoading(false)
    }
  }, [location, trip])

  async function addToItinerary(rec: NearbyRecommendation) {
    setAddingRec(rec.name)
    const res = await fetch(`/wayfarer-ai/api/trips/${trip.id}/activities`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `${rec.emoji} ${rec.name}`,
        category: rec.type,
        notes: rec.tip,
        scheduledAt: new Date().toISOString(),
      }),
    })
    if (res.ok) {
      toast.success(`Added ${rec.name} to itinerary!`)
    }
    setAddingRec(null)
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-card border-b border-border px-4 py-3 flex items-center gap-3">
        <div className="flex-1">
          <h1 className="font-semibold">Live Mode</h1>
          <p className="text-xs text-muted-foreground">{trip.destination}</p>
        </div>
        {location && (
          <div className={cn(
            'flex items-center gap-1 text-xs',
            tooFar ? 'text-amber-600' : 'text-green-600'
          )}>
            <div className={cn('w-2 h-2 rounded-full', tooFar ? 'bg-amber-500' : 'bg-green-500 animate-pulse-dot')} />
            {tooFar ? 'Not in destination' : 'GPS Active'}
          </div>
        )}
      </div>

      {/* Map placeholder / location status */}
      <div className="relative bg-gradient-to-br from-sky-100 to-blue-50 mx-4 mt-4 rounded-2xl overflow-hidden" style={{ height: 200 }}>
        {location ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <div className={cn(
              'w-12 h-12 rounded-full flex items-center justify-center shadow-lg',
              tooFar ? 'bg-amber-500' : 'bg-sky-500'
            )}>
              <Navigation className="w-6 h-6 text-white" />
            </div>
            {tooFar ? (
              <>
                <p className="text-sm font-semibold text-amber-800">You&apos;re not in {trip.destination}</p>
                <p className="text-xs text-amber-700 px-6 text-center">
                  {Math.round(distanceFromDestination!)} km away · Live Mode works when you&apos;re at your destination
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-sky-800">
                  {location.lat.toFixed(4)}°N, {location.lng.toFixed(4)}°E
                </p>
                <p className="text-xs text-sky-600">Accuracy: ±{Math.round(location.accuracy)}m</p>
              </>
            )}
          </div>
        ) : locationError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center">
            <MapPin className="w-8 h-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{locationError}</p>
          </div>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-8 h-8 text-sky-400 animate-spin" />
            <p className="text-sm text-muted-foreground">Getting your location…</p>
          </div>
        )}
      </div>

      {/* FAB + content */}
      <div className="flex-1 px-4 py-6">
        {/* Main CTA */}
        <Button
          className={cn(
            'w-full h-14 rounded-2xl text-base font-semibold gap-2 shadow-lg transition-all',
            tooFar
              ? 'bg-muted text-muted-foreground'
              : 'bg-gradient-to-r from-sunset-500 to-orange-500 text-white hover:from-sunset-600 hover:to-orange-600',
            loading && 'opacity-80',
          )}
          onClick={fetchNearby}
          disabled={loading || !location || tooFar}
        >
          {loading ? (
            <><Loader2 className="w-5 h-5 animate-spin" /> Finding the best spots…</>
          ) : tooFar ? (
            <><MapPin className="w-5 h-5" /> Travel to {trip.destination} first</>
          ) : (
            <><Zap className="w-5 h-5" /> What&#39;s Nearby? ✨</>
          )}
        </Button>

        {lastFetched && (
          <p className="text-xs text-center text-muted-foreground mt-2">
            Updated {lastFetched.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        )}

        {/* Recommendations */}
        {recommendations.length > 0 && (
          <div className="mt-6 space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Best picks right now
            </h2>
            {recommendations.map((rec, i) => (
              <RecommendationCard
                key={i}
                rec={rec}
                adding={addingRec === rec.name}
                onAdd={() => addToItinerary(rec)}
              />
            ))}
          </div>
        )}

        {!location && !locationError && (
          <div className="mt-8 text-center">
            <div className="text-5xl mb-4">📍</div>
            <p className="text-muted-foreground text-sm">Enable location to find the best nearby places in real-time.</p>
          </div>
        )}

        {location && recommendations.length === 0 && !loading && !tooFar && (
          <div className="mt-8 text-center">
            <div className="text-5xl mb-4">🗺️</div>
            <p className="font-medium mb-2">You&#39;re in {trip.destination}</p>
            <p className="text-muted-foreground text-sm">Tap &ldquo;What&#39;s Nearby?&rdquo; to get personalized AI recommendations.</p>
          </div>
        )}
      </div>
    </div>
  )
}

function RecommendationCard({
  rec, adding, onAdd
}: {
  rec: NearbyRecommendation
  adding: boolean
  onAdd: () => void
}) {
  return (
    <div className="bg-card border border-border rounded-2xl p-4 animate-fade-in">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 bg-gradient-to-br from-sky-100 to-sky-200 rounded-xl flex items-center justify-center text-xl shrink-0">
          {rec.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-sm">{rec.name}</p>
              <p className="text-xs text-muted-foreground capitalize">{rec.type}</p>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
              <Clock className="w-3 h-3" />
              {rec.walkingMins} min
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{rec.reason}</p>
          {rec.tip && (
            <p className="text-xs text-sky-600 mt-2 bg-sky-50 rounded-lg px-2 py-1">
              💡 {rec.tip}
            </p>
          )}
        </div>
      </div>
      <div className="flex gap-2 mt-3">
        <Button
          size="sm"
          variant="outline"
          className="flex-1 rounded-xl gap-1"
          onClick={onAdd}
          disabled={adding}
        >
          {adding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
          {adding ? 'Adding…' : 'Add to Itinerary'}
        </Button>
      </div>
    </div>
  )
}
