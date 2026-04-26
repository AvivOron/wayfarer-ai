'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { Search, Plus, Sparkles, Loader2, MapPin, Star, X, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Trip, Activity } from '@/types'
import { toast } from 'sonner'
import { DaySchedule, AreaPlace } from '@/lib/gemini'

interface PlaceResult {
  placeId: string
  name: string
  address: string
  lat: number
  lng: number
  rating?: number
  types: string[]
}

const SPECIFIC_TYPES = new Set(['restaurant', 'food', 'cafe', 'bar', 'bakery', 'museum', 'art_gallery', 'park', 'lodging', 'tourist_attraction', 'shopping_mall', 'store', 'night_club', 'movie_theater', 'spa', 'gym'])
const AREA_TYPES = new Set(['locality', 'sublocality', 'sublocality_level_1', 'sublocality_level_2', 'neighborhood', 'political'])

interface Props {
  trip: Trip
  onScheduleGenerated?: () => void
}

export function PlannerClient({ trip, onScheduleGenerated }: Props) {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<{ description: string; placeId: string; distanceMeters?: number }[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const autocompleteTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchWrapperRef = useRef<HTMLDivElement>(null)
  const [homeCoords, setHomeCoords] = useState<{ lat: number; lng: number } | null>(
    trip.hotelLat != null && trip.hotelLng != null ? { lat: trip.hotelLat, lng: trip.hotelLng } : null
  )
  const [results, setResults] = useState<PlaceResult[]>([])
  const [areaResults, setAreaResults] = useState<AreaPlace[]>([])
  const [searching, setSearching] = useState(false)
  const [activities, setActivities] = useState<Activity[]>(trip.activities ?? [])
  const [generating, setGenerating] = useState(false)
  const [addingPlaceId, setAddingPlaceId] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [confirmDiscard, setConfirmDiscard] = useState(false)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchWrapperRef.current && !searchWrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (homeCoords) return
    const address = trip.hotelAddress ?? trip.destination
    const params = new URLSearchParams({ q: address, destination: trip.destination })
    fetch(`/wayfarer-ai/api/places/search?${params}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        const first = data?.results?.[0]
        if (first?.lat != null) setHomeCoords({ lat: first.lat, lng: first.lng })
      })
      .catch(() => {})
  }, [])

  function handleQueryChange(value: string) {
    setQuery(value)
    setShowSuggestions(false)
    setSuggestions([])
    if (autocompleteTimer.current) clearTimeout(autocompleteTimer.current)
    if (!value.trim()) return
    autocompleteTimer.current = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ input: value })
        if (homeCoords) params.set('origin', `${homeCoords.lat},${homeCoords.lng}`)
        const res = await fetch(`/wayfarer-ai/api/places/autocomplete?${params}`)
        const data = await res.json()
        if (data.predictions?.length) {
          const sorted = [...data.predictions].sort((a, b) => {
            if (a.distanceMeters == null && b.distanceMeters == null) return 0
            if (a.distanceMeters == null) return 1
            if (b.distanceMeters == null) return -1
            return a.distanceMeters - b.distanceMeters
          })
          setSuggestions(sorted)
          setShowSuggestions(true)
        }
      } catch {
        // silently ignore autocomplete errors
      }
    }, 300)
  }

  async function handleSuggestionClick(description: string, placeId: string) {
    setQuery(description)
    setSuggestions([])
    setShowSuggestions(false)
    setSearching(true)
    setResults([])
    setAreaResults([])
    try {
      const res = await fetch(`/wayfarer-ai/api/places/detail?placeId=${encodeURIComponent(placeId)}`)
      const data = await res.json()
      if (data.placeId) {
        setResults([data])
      } else {
        searchPlaces(description)
      }
    } catch {
      searchPlaces(description)
    } finally {
      setSearching(false)
    }
  }

  async function searchPlaces(q?: string) {
    const activeQuery = q ?? query
    if (!activeQuery.trim()) return
    setSearching(true)
    setResults([])
    setAreaResults([])
    setShowSuggestions(false)
    try {
      const classifiedIntent = await classifyQueryIntent(activeQuery, trip.destination)
      if (classifiedIntent === 'area') {
        await exploreAreaQuery(activeQuery)
      } else {
        const places = await searchGooglePlaces(activeQuery)
        const fallbackIntent = classifyPlannerSearch(activeQuery, places)

        if (fallbackIntent === 'place') {
          setResults(places.filter(isSpecificPlace))
        } else {
          await exploreAreaQuery(activeQuery)
        }
      }
    } catch {
      toast.error('Search failed')
    } finally {
      setSearching(false)
    }
  }

  async function classifyQueryIntent(query: string, destination: string): Promise<'place' | 'area' | null> {
    try {
      const res = await fetch('/wayfarer-ai/api/ai/classify-planner-query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, destination }),
      })
      if (!res.ok) return null

      const data = await res.json()
      return data.intent === 'place' || data.intent === 'area' ? data.intent : null
    } catch {
      return null
    }
  }

  async function searchGooglePlaces(q: string): Promise<PlaceResult[]> {
    const params = new URLSearchParams({
      q,
      destination: trip.destination,
      lat: String(trip.lat ?? ''),
      lng: String(trip.lng ?? ''),
    })
    const res = await fetch(`/wayfarer-ai/api/places/search?${params}`)
    const data = await res.json()
    return data.results ?? []
  }

  async function exploreAreaQuery(q: string) {
    const aiRes = await fetch('/wayfarer-ai/api/ai/explore-area', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ area: q, destination: trip.destination, interests: trip.interests }),
    })
    const aiData = await aiRes.json()
    setAreaResults(aiData.places ?? [])
  }

  async function addActivity(place: PlaceResult) {
    setAddingPlaceId(place.placeId)
    const res = await fetch(`/wayfarer-ai/api/trips/${trip.id}/activities`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        placeId: place.placeId,
        name: place.name,
        address: place.address,
        lat: place.lat,
        lng: place.lng,
        category: guessCategory(place.types),
        sortOrder: activities.length,
      }),
    })
    if (res.ok) {
      const activity = await res.json()
      setActivities(a => [...a, activity])
      setResults([])
      setAreaResults([])
      setQuery('')
      toast.success(`Added ${place.name}`)
    } else {
      toast.error('Failed to add activity')
    }
    setAddingPlaceId(null)
  }

  async function addAreaPlace(place: AreaPlace) {
    setAddingPlaceId(place.name)
    const res = await fetch(`/wayfarer-ai/api/trips/${trip.id}/activities`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        placeId: null,
        name: place.name,
        address: place.address,
        lat: null,
        lng: null,
        category: place.category,
        sortOrder: activities.length,
      }),
    })
    if (res.ok) {
      const activity = await res.json()
      setActivities(a => [...a, activity])
      setAreaResults(prev => prev.filter(p => p.name !== place.name))
      toast.success(`Added ${place.name}`)
    } else {
      toast.error('Failed to add activity')
    }
    setAddingPlaceId(null)
  }

  async function removeActivity(id: string) {
    setRemovingId(id)
    const res = await fetch(`/wayfarer-ai/api/trips/${trip.id}/activities?activityId=${id}`, { method: 'DELETE' })
    if (res.ok) {
      setActivities(a => a.filter(x => x.id !== id))
    }
    setRemovingId(null)
  }

  function handleGenerateClick() {
    const hasItinerary = activities.some(a => a.aiGenerated)
    if (hasItinerary) {
      setConfirmDiscard(true)
    } else {
      generateSchedule()
    }
  }

  async function generateSchedule() {
    if (activities.length === 0) {
      toast.error('Add some spots first!')
      return
    }
    setConfirmDiscard(false)
    setGenerating(true)
    try {
      const res = await fetch('/wayfarer-ai/api/ai/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destination: trip.destination,
          startDate: trip.startDate.split('T')[0],
          endDate: trip.endDate.split('T')[0],
          hotelAddress: trip.hotelAddress ?? trip.destination,
          accommodationType: trip.accommodationType ?? 'hotel',
          transport: trip.transport,
          groupType: trip.groupType,
          groupSize: trip.groupSize,
          childAges: trip.childAges,
          interests: trip.interests,
          foodPreferences: trip.foodPreferences,
          dietaryRestrictions: trip.dietaryRestrictions,
          notes: trip.notes ?? undefined,
          mustSee: activities.map(a => ({
            name: a.name,
            address: a.address ?? '',
            category: a.category,
          })),
        }),
      })
      const data = await res.json()
      if (!data.schedule) throw new Error('No schedule returned')

      const ACCOMMODATION_NOISE = /return.*hotel|return.*home|return.*accommodation|evening relaxation|relaxation at|unwind.*hotel|unwind.*home|unwind.*friend|check.?in|relax.*hotel|relax.*accommodation|relax.*friend|head back|back to hotel|back to accommodation|at friend.s home|at the hotel/i

      // Convert AI schedule to activities and save them
      const aiActivities = (data.schedule as DaySchedule[]).flatMap((day, di) =>
        day.activities
          .filter(act => !ACCOMMODATION_NOISE.test(act.name))
          .map((act, ai) => {
          const [hours, mins] = act.time.split(':').map(Number)
          const date = new Date(day.date)
          date.setHours(hours, mins, 0, 0)
          return {
            name: `${act.emoji} ${act.name}`,
            address: act.address,
            category: act.category,
            scheduledAt: date.toISOString(),
            durationMins: act.durationMins,
            notes: act.notes,
            groupLabel: act.groupLabel ?? null,
            aiGenerated: true,
            sortOrder: di * 100 + ai,
          }
        })
      )

      // Clear only AI-generated activities and replace with new schedule
      await Promise.all(
        activities.filter(a => a.aiGenerated).map(a =>
          fetch(`/wayfarer-ai/api/trips/${trip.id}/activities?activityId=${a.id}`, { method: 'DELETE' })
        )
      )

      const saveRes = await fetch(`/wayfarer-ai/api/trips/${trip.id}/activities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(aiActivities),
      })

      if (saveRes.ok) {
        const refreshRes = await fetch(`/wayfarer-ai/api/trips/${trip.id}/activities`)
        const refreshed = await refreshRes.json()
        setActivities(refreshed)
        toast.success('Smart schedule generated!')
        onScheduleGenerated?.()
      }
    } catch (err) {
      console.error(err)
      toast.error('Failed to generate schedule. Try again.')
    } finally {
      setGenerating(false)
    }
  }

  const mustSee = activities.filter(a => !a.aiGenerated)

  return (
    <>
    <div>
      {/* Header */}
      <div className="sticky top-0 z-40 bg-card border-b border-border px-4 py-3 flex items-center gap-3">
        <Link href="/app" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="font-semibold">Planner</h1>
          <p className="text-xs text-muted-foreground">{trip.destination}</p>
        </div>
      </div>

      <div className="px-4 py-6 space-y-6">
        {/* Search */}
        <div>
          <h2 className="text-sm font-semibold mb-3">Add must-see spots</h2>
          <div className="relative flex gap-2" ref={searchWrapperRef}>
            <div className="flex-1 relative">
              <Input
                placeholder={`Search in ${trip.destination}…`}
                value={query}
                onChange={e => handleQueryChange(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && searchPlaces()}
                onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                className="rounded-xl"
              />
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-card border border-border rounded-xl shadow-lg overflow-hidden">
                  {suggestions.map(s => (
                    <button
                      key={s.placeId}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted/50 transition-colors"
                      onMouseDown={e => { e.preventDefault(); handleSuggestionClick(s.description, s.placeId) }}
                    >
                      <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span className="truncate flex-1">{s.description}</span>
                      {s.distanceMeters != null && (
                        <span className="text-xs text-muted-foreground shrink-0">
                          {s.distanceMeters < 1000
                            ? `${s.distanceMeters}m`
                            : `${(s.distanceMeters / 1000).toFixed(1)}km`}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <Button onClick={() => searchPlaces()} disabled={searching} size="icon" className="rounded-xl bg-sky-500 hover:bg-sky-600 shrink-0">
              {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            </Button>
          </div>

          {/* Google Places results */}
          {results.length > 0 && (
            <div className="mt-3 border border-border rounded-2xl overflow-hidden divide-y divide-border bg-card">
              {results.map(r => (
                <button
                  key={r.placeId}
                  className="w-full flex items-start gap-3 p-3 text-left hover:bg-muted/50 transition-colors disabled:opacity-60"
                  onClick={() => addActivity(r)}
                  disabled={addingPlaceId === r.placeId}
                >
                  <div className="w-8 h-8 bg-sky-100 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                    <MapPin className="w-4 h-4 text-sky-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{r.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{r.address}</p>
                    {r.rating && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                        <span className="text-xs text-muted-foreground">{r.rating}</span>
                      </div>
                    )}
                  </div>
                  {addingPlaceId === r.placeId
                    ? <Loader2 className="w-4 h-4 text-muted-foreground shrink-0 mt-1 animate-spin" />
                    : <Plus className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />}
                </button>
              ))}
            </div>
          )}

          {/* AI area explore results */}
          {areaResults.length > 0 && (
            <div className="mt-3">
              <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> AI picks for &quot;{query}&quot;
              </p>
              <div className="border border-border rounded-2xl overflow-hidden divide-y divide-border bg-card">
                {areaResults.map(r => (
                  <button
                    key={r.name}
                    className="w-full flex items-start gap-3 p-3 text-left hover:bg-muted/50 transition-colors disabled:opacity-60"
                    onClick={() => addAreaPlace(r)}
                    disabled={addingPlaceId === r.name}
                  >
                    <div className="w-8 h-8 bg-sky-50 rounded-lg flex items-center justify-center shrink-0 mt-0.5 text-base">
                      {r.emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{r.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{r.reason}</p>
                    </div>
                    {addingPlaceId === r.name
                      ? <Loader2 className="w-4 h-4 text-muted-foreground shrink-0 mt-1 animate-spin" />
                      : <Plus className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Must-see list */}
        {mustSee.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold">Must-see spots ({mustSee.length})</h2>
            </div>
            <div className="space-y-2">
              {mustSee.map(a => (
                <div key={a.id} className="flex items-center gap-3 p-3 bg-card border border-border rounded-xl">
                  <MapPin className="w-4 h-4 text-sky-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{a.name}</p>
                    {a.address && <p className="text-xs text-muted-foreground truncate">{a.address}</p>}
                  </div>
                  <button
                    onClick={() => removeActivity(a.id)}
                    disabled={removingId === a.id}
                    className="text-muted-foreground hover:text-destructive disabled:opacity-40"
                  >
                    {removingId === a.id
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <X className="w-4 h-4" />}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Generate button */}
        <Button
          className="w-full bg-gradient-to-r from-sky-500 to-ocean-500 text-white rounded-2xl h-12 font-semibold gap-2 shadow-lg"
          onClick={handleGenerateClick}
          disabled={generating || mustSee.length === 0}
        >
          {generating ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Generating smart schedule…</>
          ) : (
            <><Sparkles className="w-4 h-4" /> Generate Smart Schedule</>
          )}
        </Button>
        {mustSee.length === 0 && (
          <p className="text-xs text-center text-muted-foreground -mt-4">Add at least one spot to generate a schedule</p>
        )}
      </div>


    </div>

    {/* Discard confirmation */}
    {confirmDiscard && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/40" onClick={() => setConfirmDiscard(false)} />
        <div className="relative bg-card rounded-2xl shadow-xl p-6 w-full max-w-sm space-y-4">
          <h2 className="font-semibold text-base">Discard current itinerary?</h2>
          <p className="text-sm text-muted-foreground">Generating a new schedule will replace your existing itinerary. This can&apos;t be undone.</p>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setConfirmDiscard(false)}>Cancel</Button>
            <Button className="flex-1 bg-gradient-to-r from-sky-500 to-ocean-500 text-white" onClick={generateSchedule}>Regenerate</Button>
          </div>
        </div>
      </div>
    )}
    </>
  )
}

function guessCategory(types: string[]): string {
  if (types.some(t => ['restaurant', 'food', 'cafe', 'bakery', 'bar'].includes(t))) return 'restaurant'
  if (types.some(t => ['museum', 'art_gallery'].includes(t))) return 'museum'
  if (types.some(t => ['park', 'natural_feature'].includes(t))) return 'park'
  if (types.some(t => ['lodging', 'hotel'].includes(t))) return 'hotel'
  return 'attraction'
}

function classifyPlannerSearch(query: string, places: PlaceResult[]): 'place' | 'area' {
  if (places.length === 0) return 'area'

  const q = normalizeSearchText(query)
  const top = places[0]
  const topName = normalizeSearchText(top.name)
  const topIsArea = top.types.some(t => AREA_TYPES.has(t))

  if (topIsArea && topName === q) return 'area'

  const matchingSpecificPlaces = places
    .slice(0, 5)
    .filter(place => isSpecificPlace(place) && isNameMatch(query, place.name))

  if (matchingSpecificPlaces.length >= 2) return 'place'
  if (matchingSpecificPlaces.length >= 1 && !topIsArea) return 'place'

  return 'area'
}

function isSpecificPlace(place: PlaceResult): boolean {
  return place.types.some(t => SPECIFIC_TYPES.has(t))
}

function isNameMatch(query: string, name: string): boolean {
  const q = normalizeSearchText(query)
  const n = normalizeSearchText(name)
  return n === q || n.startsWith(`${q} `) || n.includes(` ${q} `)
}

function normalizeSearchText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}
