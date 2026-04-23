'use client'

import { useState } from 'react'
import { Search, Plus, Sparkles, Loader2, MapPin, Star, X } from 'lucide-react'
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
}

export function PlannerClient({ trip }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PlaceResult[]>([])
  const [areaResults, setAreaResults] = useState<AreaPlace[]>([])
  const [searching, setSearching] = useState(false)
  const [activities, setActivities] = useState<Activity[]>(trip.activities ?? [])
  const [generating, setGenerating] = useState(false)
  const [addingPlaceId, setAddingPlaceId] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)

  async function searchPlaces() {
    if (!query.trim()) return
    setSearching(true)
    setResults([])
    setAreaResults([])
    try {
      const classifiedIntent = await classifyQueryIntent(query, trip.destination)
      if (classifiedIntent === 'area') {
        await exploreAreaQuery()
      } else {
        const places = await searchGooglePlaces()
        const fallbackIntent = classifyPlannerSearch(query, places)

        if (fallbackIntent === 'place') {
          setResults(places.filter(isSpecificPlace))
        } else {
          await exploreAreaQuery()
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

  async function searchGooglePlaces(): Promise<PlaceResult[]> {
    const params = new URLSearchParams({
      q: query,
      destination: trip.destination,
      lat: String(trip.lat ?? ''),
      lng: String(trip.lng ?? ''),
    })
    const res = await fetch(`/wayfarer-ai/api/places/search?${params}`)
    const data = await res.json()
    return data.results ?? []
  }

  async function exploreAreaQuery() {
    const aiRes = await fetch('/wayfarer-ai/api/ai/explore-area', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ area: query, destination: trip.destination, interests: trip.interests }),
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

  async function generateSchedule() {
    if (activities.length === 0) {
      toast.error('Add some spots first!')
      return
    }
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

      // Convert AI schedule to activities and save them
      const aiActivities = (data.schedule as DaySchedule[]).flatMap((day, di) =>
        day.activities.map((act, ai) => {
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
            aiGenerated: true,
            sortOrder: di * 100 + ai,
          }
        })
      )

      // Clear AI-generated ones and replace
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
        toast.success('Smart schedule generated! 🎉 Check the Itinerary tab.')
        // Refresh activities
        const refreshRes = await fetch(`/wayfarer-ai/api/trips/${trip.id}/activities`)
        const refreshed = await refreshRes.json()
        setActivities(refreshed)
      }
    } catch (err) {
      console.error(err)
      toast.error('Failed to generate schedule. Try again.')
    } finally {
      setGenerating(false)
    }
  }

  const mustSee = activities.filter(a => !a.aiGenerated)
  const scheduled = activities.filter(a => a.aiGenerated)

  return (
    <div>
      {/* Header */}
      <div className="sticky top-0 z-40 bg-card border-b border-border px-4 py-3">
        <h1 className="font-semibold">Planner</h1>
        <p className="text-xs text-muted-foreground">{trip.destination}</p>
      </div>

      <div className="px-4 py-6 space-y-6">
        {/* Search */}
        <div>
          <h2 className="text-sm font-semibold mb-3">Add must-see spots</h2>
          <div className="flex gap-2">
            <Input
              placeholder={`Search in ${trip.destination}…`}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && searchPlaces()}
              className="flex-1 rounded-xl"
            />
            <Button onClick={searchPlaces} disabled={searching} size="icon" className="rounded-xl bg-sky-500 hover:bg-sky-600 shrink-0">
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
          onClick={generateSchedule}
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

        {/* AI-scheduled activities */}
        {scheduled.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              AI-Scheduled ({scheduled.length})
            </h2>
            <div className="space-y-2">
              {scheduled.slice(0, 5).map(a => (
                <div key={a.id} className="flex items-center gap-3 p-3 bg-card border border-border rounded-xl opacity-80">
                  <Sparkles className="w-4 h-4 text-sky-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{a.name}</p>
                  </div>
                </div>
              ))}
              {scheduled.length > 5 && (
                <p className="text-xs text-center text-muted-foreground">+{scheduled.length - 5} more in Itinerary</p>
              )}
            </div>
          </div>
        )}
      </div>


    </div>
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
