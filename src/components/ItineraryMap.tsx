'use client'

import { useEffect, useRef, useState } from 'react'
import { Activity } from '@/types'
import { format } from 'date-fns'

interface Props {
  activities: Activity[]
  tripDestination: string
}

type GroupedDay = { label: string; date: Date; activities: ResolvedActivity[] }

// Include all scheduled activities regardless of whether they have coordinates
function groupByDay(activities: ResolvedActivity[]): GroupedDay[] {
  const map = new Map<string, Activity[]>()
  for (const a of activities) {
    if (!a.scheduledAt) continue
    const key = new Date(a.scheduledAt).toDateString()
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(a)
  }

  const days: GroupedDay[] = []
  map.forEach((acts) => {
    const date = new Date(acts[0].scheduledAt!)
    days.push({ label: format(date, 'EEE, MMM d'), date, activities: acts })
  })
  return days.sort((a, b) => a.date.getTime() - b.date.getTime())
}

const SKIP_GEOCODE = /breakfast|lunch|dinner|check.?in|check.?out|hotel|accommodation|hostel|airbnb/i

// Geocode a single activity via the server-side places proxy
async function geocodeActivity(a: Activity, destination: string): Promise<{ lat: number; lng: number } | null> {
  if (SKIP_GEOCODE.test(a.name)) return null
  if (!a.address || a.address.trim().toLowerCase() === destination.trim().toLowerCase()) return null
  try {
    const query = `${a.name} ${a.address}`
    const params = new URLSearchParams({ q: query, destination })
    const res = await fetch(`/wayfarer-ai/api/places/search?${params}`)
    if (!res.ok) return null
    const data = await res.json()
    const first = data.results?.[0]
    if (first?.lat && first?.lng) return { lat: first.lat, lng: first.lng }
  } catch {
    // best-effort
  }
  return null
}

// Activity with resolved coordinates (may differ from DB if geocoded client-side)
type ResolvedActivity = Activity & { resolvedLat?: number; resolvedLng?: number }

const DAY_COLORS = [
  '#0ea5e9', '#f97316', '#8b5cf6', '#10b981',
  '#ef4444', '#f59e0b', '#ec4899', '#14b8a6',
]

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    google: any
    initWayfarerMap: () => void
  }
}

export function ItineraryMap({ activities, tripDestination }: Props) {
  const mapRef = useRef<HTMLDivElement>(null)
  const [selectedDay, setSelectedDay] = useState(0)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [resolvedActivities, setResolvedActivities] = useState<ResolvedActivity[]>(activities)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstance = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersRef = useRef<any[]>([])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const polylinesRef = useRef<any[]>([])
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null)

  const days = groupByDay(resolvedActivities)

  // Geocode any scheduled activities that lack coordinates
  useEffect(() => {
    const missing = activities.filter(a => a.scheduledAt && !a.lat && !a.lng)
    if (missing.length === 0) return

    Promise.all(
      missing.map(async (a) => {
        const geo = await geocodeActivity(a, tripDestination)
        return { id: a.id, geo }
      })
    ).then(results => {
      setResolvedActivities(prev =>
        prev.map(a => {
          const found = results.find(r => r.id === a.id)
          if (found?.geo) return { ...a, resolvedLat: found.geo.lat, resolvedLng: found.geo.lng }
          return a
        })
      )
    })
  }, [activities, tripDestination])

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
    if (!apiKey) return

    if (window.google?.maps?.marker?.AdvancedMarkerElement) {
      setMapLoaded(true)
      return
    }

    window.initWayfarerMap = () => setMapLoaded(true)

    if (!document.querySelector('#wayfarer-maps-script')) {
      const script = document.createElement('script')
      script.id = 'wayfarer-maps-script'
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=marker&callback=initWayfarerMap`
      script.async = true
      script.defer = true
      document.head.appendChild(script)
    }
  }, [])

  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return

    const firstActivity = resolvedActivities.find(a => a.lat || a.resolvedLat)
    const lat = firstActivity?.lat ?? firstActivity?.resolvedLat ?? 48.8566
    const lng = firstActivity?.lng ?? firstActivity?.resolvedLng ?? 2.3522

    mapInstance.current = new window.google.maps.Map(mapRef.current, {
      center: { lat, lng },
      zoom: 13,
      mapId: process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      zoomControlOptions: { position: window.google.maps.ControlPosition.RIGHT_CENTER },
    })

    infoWindowRef.current = new window.google.maps.InfoWindow()
  }, [mapLoaded, resolvedActivities])

  useEffect(() => {
    if (!mapInstance.current || !mapLoaded) return

    markersRef.current.forEach(m => m.map = null)
    polylinesRef.current.forEach(p => p.setMap(null))
    markersRef.current = []
    polylinesRef.current = []
    infoWindowRef.current?.close()

    const day = days[selectedDay]
    if (!day) return

    const color = DAY_COLORS[selectedDay % DAY_COLORS.length]
    const bounds = new window.google.maps.LatLngBounds()
    let pinIndex = 0

    // Build ordered list of {pos, isTransport} for all activities with coordinates
    const mappable = day.activities
      .map(a => {
        const lat = a.lat ?? a.resolvedLat
        const lng = a.lng ?? a.resolvedLng
        if (!lat || !lng) return null
        return { activity: a, pos: { lat, lng }, isTransport: a.category === 'transport' }
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)

    // Place markers for non-transport activities
    mappable.forEach(({ activity, pos, isTransport }) => {
      bounds.extend(pos) // extend bounds for all points including transit stops
      if (isTransport) return

      pinIndex++

      const pin = new window.google.maps.marker.PinElement({
        glyph: String(pinIndex),
        glyphColor: '#ffffff',
        background: color,
        borderColor: '#ffffff',
      })

      const marker = new window.google.maps.marker.AdvancedMarkerElement({
        position: pos,
        map: mapInstance.current,
        title: activity.name,
        content: pin.element,
      })

      marker.addListener('click', () => {
        const mapsUrl = activity.placeId
          ? `https://www.google.com/maps/place/?q=place_id:${activity.placeId}`
          : `https://www.google.com/maps/search/?api=1&query=${pos.lat},${pos.lng}`
        infoWindowRef.current?.setContent(
          `<div style="font-family:sans-serif;max-width:220px;padding:2px 0">
            <strong style="font-size:13px">${activity.name}</strong>
            ${activity.scheduledAt ? `<p style="color:#666;font-size:12px;margin:3px 0 0">${format(new Date(activity.scheduledAt), 'HH:mm')}${activity.durationMins ? ` · ${activity.durationMins} min` : ''}</p>` : ''}
            ${activity.address ? `<p style="color:#888;font-size:11px;margin:3px 0 0">${activity.address}</p>` : ''}
            ${activity.notes ? `<p style="color:#555;font-size:11px;margin:5px 0 0;font-style:italic">${activity.notes}</p>` : ''}
            <a href="${mapsUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-flex;align-items:center;gap:4px;margin-top:8px;color:#0ea5e9;font-size:11px;font-weight:500;text-decoration:none">
              Open in Google Maps ↗
            </a>
          </div>`
        )
        infoWindowRef.current?.open(mapInstance.current, marker)
      })

      markersRef.current.push(marker)
    })

    // Draw segments between consecutive points — dotted if a transport leg sits between them
    for (let i = 0; i < mappable.length - 1; i++) {
      const from = mappable[i]
      const to = mappable[i + 1]
      // A segment is a "transit" segment if either endpoint is transport
      const isTransitSegment = from.isTransport || to.isTransport

      const polyline = new window.google.maps.Polyline({
        path: [from.pos, to.pos],
        geodesic: true,
        strokeColor: color,
        strokeOpacity: isTransitSegment ? 0 : 0.75,
        strokeWeight: 3,
        icons: isTransitSegment
          ? [
              // Dotted pattern for transit legs
              {
                icon: { path: 'M 0,-1 0,1', strokeOpacity: 0.8, scale: 3 },
                offset: '0',
                repeat: '12px',
              },
              // Arrow in the middle
              {
                icon: { path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW, scale: 2.5, strokeOpacity: 0.8 },
                offset: '50%',
              },
            ]
          : [
              // Solid arrow for walking/direct
              {
                icon: { path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW, scale: 3 },
                offset: '50%',
              },
            ],
      })
      polyline.setMap(mapInstance.current)
      polylinesRef.current.push(polyline)
    }

    if (!bounds.isEmpty()) {
      mapInstance.current.fitBounds(bounds, 60)
    }
  }, [selectedDay, days, mapLoaded, resolvedActivities])

  if (!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <div className="text-4xl mb-3">🗺️</div>
        <p className="text-muted-foreground text-sm">Map requires <code>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code></p>
      </div>
    )
  }

  if (days.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <div className="text-4xl mb-3">📍</div>
        <p className="text-sm font-medium mb-1">No scheduled activities yet</p>
        <p className="text-muted-foreground text-sm">Generate a schedule in the Planner to see your route here.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Day selector — always visible at top */}
      <div className="flex gap-2 px-4 pt-6 pb-3 overflow-x-auto scrollbar-hide shrink-0">
        {days.map((day, i) => (
          <button
            key={i}
            onClick={() => setSelectedDay(i)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border-2 transition-all ${
              selectedDay === i
                ? 'text-white border-transparent'
                : 'border-border text-muted-foreground bg-card hover:border-primary/50'
            }`}
            style={selectedDay === i ? { backgroundColor: DAY_COLORS[i % DAY_COLORS.length] } : {}}
          >
            {day.label}
          </button>
        ))}
      </div>

      {/* Map — takes remaining space */}
      <div ref={mapRef} className="flex-1 min-h-0" />

      {/* Activity list for selected day — fixed height at bottom */}
      {days[selectedDay] && (() => {
        let pinCounter = 0
        return (
        <div className="px-4 py-3 space-y-1 h-44 overflow-y-auto border-t border-border bg-card shrink-0">
          {days[selectedDay].activities.map((a) => {
            const lat = a.lat ?? a.resolvedLat
            const lng = a.lng ?? a.resolvedLng
            const hasCords = !!(lat && lng) && a.category !== 'transport'
            if (hasCords) pinCounter++
            const displayNum = hasCords ? pinCounter : null
            const mapsUrl = hasCords
              ? a.placeId
                ? `https://www.google.com/maps/place/?q=place_id:${a.placeId}`
                : `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
              : null
            return (
              <div key={a.id} className="flex items-center gap-2 text-sm py-1">
                <span
                  className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                  style={{ backgroundColor: hasCords ? DAY_COLORS[selectedDay % DAY_COLORS.length] : '#d1d5db' }}
                >
                  {displayNum ?? '–'}
                </span>
                {mapsUrl ? (
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium truncate text-sky-600 hover:underline"
                  >
                    {a.name}
                  </a>
                ) : (
                  <span className={`font-medium truncate ${!hasCords ? 'text-muted-foreground' : ''}`}>{a.name}</span>
                )}
                {!hasCords && <span className="text-xs text-muted-foreground shrink-0">no location</span>}
                {a.scheduledAt && hasCords && (
                  <span className="text-muted-foreground text-xs shrink-0 ml-auto">
                    {format(new Date(a.scheduledAt), 'HH:mm')}
                  </span>
                )}
              </div>
            )
          })}
        </div>
        )
      })()}
    </div>
  )
}
