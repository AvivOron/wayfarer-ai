'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, CheckCircle2, ChevronDown, Circle, Clock, ExternalLink, List, Loader2, Map as MapIcon, MapPin, Pencil, Phone, Share2, Smile, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { Trip, Activity } from '@/types'
import { format, differenceInDays } from 'date-fns'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { MemorySheet } from '@/components/MemorySheet'
import { ItineraryMap } from '@/components/ItineraryMap'

interface Props {
  trip: Trip
}

type GroupedDay = { date: Date; activities: Activity[] }

const DAY_COLORS = [
  '#0ea5e9', '#f97316', '#8b5cf6', '#10b981',
  '#ef4444', '#f59e0b', '#ec4899', '#14b8a6',
]

const CATEGORY_EMOJI: Record<string, string> = {
  attraction: '🏯',
  restaurant: '🍜',
  cafe: '☕',
  museum: '🎨',
  park: '🌳',
  hotel: '🏨',
  transport: '🚌',
  other: '📌',
}

function buildTripShareText(trip: Trip, grouped: GroupedDay[]): string {
  const nights = differenceInDays(new Date(trip.endDate), new Date(trip.startDate))
  const dateRange = `${format(new Date(trip.startDate), 'MMM d')} – ${format(new Date(trip.endDate), 'MMM d, yyyy')}`

  const lines: string[] = [
    `✈ *${trip.title}*`,
    `📌 ${trip.destination}`,
    `🗓 ${dateRange} · ${nights} night${nights !== 1 ? 's' : ''}`,
  ]

  if (trip.hotelAddress) {
    lines.push(`🏨 ${trip.hotelAddress}`)
  }

  const scheduled = grouped.filter(d => d.date.getTime() !== 8640000000000000)

  scheduled.forEach((day, di) => {
    lines.push('')
    lines.push(`📅 *Day ${di + 1} — ${format(day.date, 'EEEE, MMM d')}*`)
    day.activities.forEach(a => {
      const emoji = CATEGORY_EMOJI[a.category] ?? '📌'
      const time = a.scheduledAt ? format(new Date(a.scheduledAt), 'HH:mm') + ' ' : ''
      const dur = a.durationMins ? ` (${a.durationMins < 60 ? `${a.durationMins}min` : `${Math.round(a.durationMins / 60 * 10) / 10}h`})` : ''
      lines.push(`${emoji} ${time}${a.name}${dur}`)
      if (a.notes) lines.push(`   _${a.notes}_`)
    })
  })

  lines.push('')
  lines.push('_Shared via Wayfarer AI_ 🌍')

  return lines.join('\n')
}

function groupByDay(activities: Activity[]): GroupedDay[] {
  const map = new Map<string, Activity[]>()
  for (const a of activities) {
    if (!a.scheduledAt) continue
    const key = new Date(a.scheduledAt).toDateString()
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(a)
  }

  const days: GroupedDay[] = []
  map.forEach((acts, key) => {
    const date = key === 'unscheduled' ? new Date(8640000000000000) : new Date(acts[0].scheduledAt!)
    days.push({ date, activities: acts })
  })

  return days.sort((a, b) => a.date.getTime() - b.date.getTime())
}

const MEMORY_EMOJIS = ['😍', '🤩', '😊', '😴', '😤', '🥹', '🎉', '🤔']

export function ItineraryClient({ trip }: Props) {
  const [activities, setActivities] = useState<Activity[]>(trip.activities ?? [])
  const [memoryActivity, setMemoryActivity] = useState<Activity | null>(null)
  const [view, setView] = useState<'list' | 'map'>('list')


  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [editActivity, setEditActivity] = useState<Activity | null>(null)
  const [selectedDay, setSelectedDay] = useState<number | null>(null)

  const grouped = groupByDay(activities)
  const visibleDays = selectedDay === null ? grouped : grouped.filter((_, i) => i === selectedDay)
  async function toggleVisited(activity: Activity) {
    setTogglingId(activity.id)
    const res = await fetch(`/wayfarer-ai/api/trips/${trip.id}/activities`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activityId: activity.id, visited: !activity.visited }),
    })
    if (res.ok) {
      const updated = await res.json()
      setActivities(a => a.map(x => x.id === activity.id ? updated : x))
      if (!activity.visited) {
        toast.success(`Visited! ${activity.name}`)
        setMemoryActivity({ ...activity, visited: true })
      }
    }
    setTogglingId(null)
  }

  async function saveMemory(activityId: string, emoji: string, text: string) {
    const res = await fetch(`/wayfarer-ai/api/trips/${trip.id}/activities`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activityId, memoryEmoji: emoji, memory: text }),
    })
    if (res.ok) {
      const updated = await res.json()
      setActivities(a => a.map(x => x.id === activityId ? updated : x))
      toast.success('Memory saved! ✨')
    }
    setMemoryActivity(null)
  }

  async function saveEdit(activityId: string, patch: { name: string; scheduledAt: string | null; durationMins: number | null; notes: string | null }) {
    const res = await fetch(`/wayfarer-ai/api/trips/${trip.id}/activities`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activityId, ...patch }),
    })
    if (res.ok) {
      const updated = await res.json()
      setActivities(a => a.map(x => x.id === activityId ? updated : x))
      toast.success('Activity updated')
    }
    setEditActivity(null)
  }

  async function deleteActivity(id: string) {
    setDeletingId(id)
    const res = await fetch(`/wayfarer-ai/api/trips/${trip.id}/activities?activityId=${id}`, { method: 'DELETE' })
    if (res.ok) {
      setActivities(a => a.filter(x => x.id !== id))
    }
    setDeletingId(null)
  }

  if (activities.length === 0) {
    return (
      <div>
        <Header tripId={trip.id} destination={trip.destination} view={view} onViewChange={setView} trip={trip} grouped={[]} />
        <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
          <div className="text-5xl mb-4">📅</div>
          <h2 className="text-lg font-semibold mb-2">No itinerary yet</h2>
          <p className="text-muted-foreground text-sm mb-6">Go to the Planner to add spots and generate your smart schedule.</p>
          <Button asChild className="bg-sky-500 hover:bg-sky-600 rounded-2xl">
            <Link href={`/trips/${trip.id}/planner`}>Go to Planner</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <Header tripId={trip.id} destination={trip.destination} view={view} onViewChange={setView} trip={trip} grouped={grouped} />
      {view === 'map' ? (
        <div className="fixed inset-0 z-10 flex flex-col" style={{ top: '57px', bottom: '72px' }}>
          <ItineraryMap activities={activities} tripDestination={trip.destination} />
        </div>
      ) : (
      <div className="py-6 space-y-8">
        {/* Day pills */}
        <div className="flex gap-2 px-4 overflow-x-auto scrollbar-hide">
          <button
            onClick={() => setSelectedDay(null)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border-2 transition-all ${selectedDay === null ? 'bg-primary text-white border-transparent' : 'border-border text-muted-foreground bg-card hover:border-primary/50'}`}
          >
            All
          </button>
          {grouped.map((day, i) => (
            <button
              key={i}
              onClick={() => setSelectedDay(selectedDay === i ? null : i)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border-2 transition-all ${selectedDay === i ? 'text-white border-transparent' : 'border-border text-muted-foreground bg-card hover:border-primary/50'}`}
              style={selectedDay === i ? { backgroundColor: DAY_COLORS[i % DAY_COLORS.length] } : {}}
            >
              {format(day.date, 'EEE, MMM d')}
            </button>
          ))}
        </div>
        <div className="px-4 space-y-8">
        {visibleDays.map((day, di) => (
          <div key={di}>
            {day.date.getTime() !== 8640000000000000 ? (
              <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wide mb-4 flex items-center gap-2">
                <span className="w-6 h-6 bg-primary/10 text-primary rounded-full text-xs flex items-center justify-center font-bold">
                  {di + 1}
                </span>
                {format(day.date, 'EEEE, MMM d')}
              </h2>
            ) : (
              <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wide mb-4">Unscheduled</h2>
            )}

            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-5 top-4 bottom-4 w-0.5 bg-border" />

              <div className="space-y-3">
                {(() => {
                  type Bucket = { groupLabel: string; activities: typeof day.activities } | { groupLabel: null; activity: (typeof day.activities)[0] }
                  const buckets: Bucket[] = []
                  for (const activity of day.activities) {
                    if (activity.groupLabel) {
                      const last = buckets[buckets.length - 1]
                      if (last && last.groupLabel === activity.groupLabel) {
                        (last as { groupLabel: string; activities: typeof day.activities }).activities.push(activity)
                      } else {
                        buckets.push({ groupLabel: activity.groupLabel, activities: [activity] })
                      }
                    } else {
                      buckets.push({ groupLabel: null, activity })
                    }
                  }
                  return buckets.map((bucket, bi) => {
                    if (bucket.groupLabel === null) {
                      const a = bucket.activity
                      return (
                        <ActivityRow key={a.id} activity={a} toggling={togglingId === a.id} deleting={deletingId === a.id}
                          onToggle={toggleVisited} onMemory={setMemoryActivity} onDelete={deleteActivity} onEdit={setEditActivity} />
                      )
                    }
                    return (
                      <div key={bi} className="relative">
                        {/* label sits above the group box, aligned with the cards (past the timeline dots) */}
                        <div className="pl-11 pb-1.5">
                          <span className="text-xs font-semibold text-sky-500 uppercase tracking-wide">{bucket.groupLabel}</span>
                        </div>
                        {/* light background box wrapping just the card column */}
                        <div className="relative">
                          <div className="absolute left-11 right-0 top-0 bottom-0 bg-sky-50 border border-sky-100 rounded-2xl" />
                          <div className="relative space-y-3 py-2">
                            {bucket.activities.map(a => (
                              <ActivityRow key={a.id} activity={a} toggling={togglingId === a.id} deleting={deletingId === a.id}
                                onToggle={toggleVisited} onMemory={setMemoryActivity} onDelete={deleteActivity} onEdit={setEditActivity} />
                            ))}
                          </div>
                        </div>
                      </div>
                    )
                  })
                })()}
              </div>
            </div>
          </div>
        ))}
        </div>
      </div>
      )}

      {memoryActivity && (
        <MemorySheet
          activity={memoryActivity}
          emojis={MEMORY_EMOJIS}
          onSave={saveMemory}
          onClose={() => setMemoryActivity(null)}
        />
      )}
      {editActivity && (
        <EditActivitySheet
          activity={editActivity}
          onSave={saveEdit}
          onClose={() => setEditActivity(null)}
        />
      )}
    </div>
  )
}

function EditActivitySheet({ activity, onSave, onClose }: {
  activity: Activity
  onSave: (id: string, patch: { name: string; scheduledAt: string | null; durationMins: number | null; notes: string | null }) => void
  onClose: () => void
}) {
  const [name, setName] = useState(activity.name)
  const [time, setTime] = useState(activity.scheduledAt ? format(new Date(activity.scheduledAt), 'HH:mm') : '')
  const [duration, setDuration] = useState(activity.durationMins?.toString() ?? '')
  const [notes, setNotes] = useState(activity.notes ?? '')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    let scheduledAt = activity.scheduledAt
    if (time && activity.scheduledAt) {
      const [h, m] = time.split(':').map(Number)
      const d = new Date(activity.scheduledAt)
      d.setHours(h, m, 0, 0)
      scheduledAt = d.toISOString()
    }
    await onSave(activity.id, {
      name: name.trim() || activity.name,
      scheduledAt,
      durationMins: duration ? parseInt(duration) : null,
      notes: notes.trim() || null,
    })
    setSaving(false)
  }

  return (
    <Sheet open onOpenChange={open => !open && onClose()}>
      <SheetContent side="bottom" className="rounded-t-2xl px-4 pb-8 pt-4 space-y-4">
        <SheetTitle>Edit activity</SheetTitle>
        <div className="space-y-3">
          <div>
            <Label htmlFor="ea-name">Name</Label>
            <Input id="ea-name" value={name} onChange={e => setName(e.target.value)} className="mt-1 h-11 rounded-xl" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="ea-time">Time</Label>
              <Input id="ea-time" type="time" value={time} onChange={e => setTime(e.target.value)} className="mt-1 h-11 rounded-xl" />
            </div>
            <div>
              <Label htmlFor="ea-dur">Duration (min)</Label>
              <Input id="ea-dur" type="number" min={0} value={duration} onChange={e => setDuration(e.target.value)} className="mt-1 h-11 rounded-xl" />
            </div>
          </div>
          <div>
            <Label htmlFor="ea-notes">Notes</Label>
            <Input id="ea-notes" value={notes} onChange={e => setNotes(e.target.value)} className="mt-1 h-11 rounded-xl" />
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving} className="w-full h-11 rounded-2xl bg-sky-500 hover:bg-sky-600 text-white">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
        </Button>
      </SheetContent>
    </Sheet>
  )
}

function Header({ destination, view, onViewChange, trip, grouped }: {
  tripId: string
  destination: string
  view: 'list' | 'map'
  onViewChange: (v: 'list' | 'map') => void
  trip: Trip
  grouped: GroupedDay[]
}) {
  async function shareTrip() {
    const text = buildTripShareText(trip, grouped)
    try {
      await navigator.clipboard.writeText(text)
      toast.success('Itinerary copied! Paste it to your friends 📋')
    } catch {
      // Fallback for browsers that block clipboard access
      const url = `https://wa.me/?text=${encodeURIComponent(text)}`
      window.open(url, '_blank', 'noopener,noreferrer')
    }
  }

  return (
    <div className="sticky top-0 z-40 bg-card border-b border-border px-4 py-3 flex items-center gap-3">
      <Link href="/app" className="text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-5 h-5" />
      </Link>
      <div className="flex-1">
        <h1 className="font-semibold">Itinerary</h1>
        <p className="text-xs text-muted-foreground">{destination}</p>
      </div>
      <div className="flex items-center bg-muted rounded-lg p-0.5 gap-0.5">
        <button
          onClick={() => onViewChange('list')}
          className={cn(
            'flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all',
            view === 'list' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'
          )}
        >
          <List className="w-3.5 h-3.5" /> List
        </button>
        <button
          onClick={() => onViewChange('map')}
          className={cn(
            'flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all',
            view === 'map' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'
          )}
        >
          <MapIcon className="w-3.5 h-3.5" /> Map
        </button>
      </div>
      {grouped.length > 0 && (
        <button
          onClick={shareTrip}
          className="w-8 h-8 rounded-lg bg-[#25D366]/10 hover:bg-[#25D366]/20 flex items-center justify-center transition-colors"
          title="Share your trip"
        >
          <Share2 className="w-4 h-4 text-[#25D366]" />
        </button>
      )}
    </div>
  )
}

interface PlaceDetail {
  openNow?: boolean
  openingHours?: string[]
  phone?: string
  website?: string
  rating?: number
  priceLevel?: number
}

function ActivityRow({
  activity, toggling, deleting, onToggle, onMemory, onDelete, onEdit,
}: {
  activity: Activity
  toggling: boolean
  deleting: boolean
  onToggle: (a: Activity) => void
  onMemory: (a: Activity) => void
  onDelete: (id: string) => void
  onEdit: (a: Activity) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [detail, setDetail] = useState<PlaceDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  // Show expand chevron if we have a placeId, or a name+address to search with
  const canExpand = !!(activity.placeId || (activity.name && activity.address))

  async function toggleExpand() {
    if (!canExpand) return
    const next = !expanded
    setExpanded(next)
    if (next && !detail) {
      setDetailLoading(true)
      try {
        if (activity.placeId) {
          const res = await fetch(`/wayfarer-ai/api/places/detail?placeId=${activity.placeId}`)
          if (res.ok) setDetail(await res.json())
        } else {
          // Search by name + address to find the placeId, then fetch details
          const q = encodeURIComponent(`${activity.name} ${activity.address ?? ''}`.trim())
          const res = await fetch(`/wayfarer-ai/api/places/search?q=${q}`)
          if (res.ok) {
            const data = await res.json()
            const first = data.results?.[0]
            if (first?.placeId) {
              const detailRes = await fetch(`/wayfarer-ai/api/places/detail?placeId=${first.placeId}`)
              if (detailRes.ok) setDetail(await detailRes.json())
            }
          }
        }
      } catch { /* silent */ }
      finally { setDetailLoading(false) }
    }
  }

  const mapsUrl = activity.placeId
    ? `https://www.google.com/maps/place/?q=place_id:${activity.placeId}`
    : activity.lat && activity.lng
      ? `https://www.google.com/maps/search/?api=1&query=${activity.lat},${activity.lng}`
      : activity.address
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(activity.address)}`
        : null

  return (
    <div className="flex gap-3 pl-0 min-w-0">
      {/* Timeline dot */}
      <button
        onClick={() => !toggling && onToggle(activity)}
        disabled={toggling}
        className="relative z-10 shrink-0 w-10 h-10 flex items-center justify-center"
      >
        {toggling ? (
          <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
        ) : activity.visited ? (
          <CheckCircle2 className="w-6 h-6 text-green-500" />
        ) : (
          <Circle className="w-6 h-6 text-muted-foreground/40" />
        )}
      </button>

      {/* Card */}
      <div className={cn(
        'flex-1 min-w-0 bg-card border rounded-2xl p-3 transition-all',
        activity.visited ? 'border-green-200 bg-green-50/50' : 'border-border',
      )}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className={cn('font-medium text-sm', activity.visited && 'line-through text-muted-foreground')}>
              {activity.name}
            </p>
            {activity.address && (
              <div className="flex items-center gap-1 mt-1 min-w-0">
                <MapPin className="w-3 h-3 text-muted-foreground shrink-0" />
                {mapsUrl ? (
                  <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-sky-600 hover:underline truncate flex items-center gap-0.5 min-w-0"
                    onClick={e => e.stopPropagation()}>
                    <span className="truncate">{activity.address}</span>
                    <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                  </a>
                ) : (
                  <p className="text-xs text-muted-foreground truncate">{activity.address}</p>
                )}
              </div>
            )}
            {activity.scheduledAt && (
              <div className="flex items-center gap-1 mt-1">
                <Clock className="w-3 h-3 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">
                  {format(new Date(activity.scheduledAt), 'HH:mm')}
                  {!!activity.durationMins && ` · ${activity.durationMins} min`}
                </p>
              </div>
            )}
            {activity.notes && (
              <p className="text-xs text-muted-foreground mt-1 italic">{activity.notes}</p>
            )}
            {activity.memory && (
              <p className="text-xs text-foreground mt-2 bg-yellow-50 border border-yellow-200 rounded-lg px-2 py-1">
                {activity.memoryEmoji} {activity.memory}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {activity.visited && (
              <button onClick={() => onMemory(activity)}
                className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground">
                <Smile className="w-3.5 h-3.5" />
              </button>
            )}
            <button onClick={() => onEdit(activity)}
              className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground">
              <Pencil className="w-3.5 h-3.5" />
            </button>
            {canExpand && (
              <button onClick={toggleExpand}
                className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground">
                <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', expanded && 'rotate-180')} />
              </button>
            )}
            <button
              onClick={() => !deleting && onDelete(activity.id)}
              disabled={deleting}
              className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-destructive"
            >
              {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Expanded detail panel */}
        {expanded && (
          <div className="mt-3 pt-3 border-t border-border space-y-2 min-w-0 overflow-hidden">
            {detailLoading ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading details…
              </div>
            ) : detail ? (
              <>
                {/* Open / closed status */}
                {detail.openNow !== undefined && (
                  <div className={cn(
                    'inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full',
                    detail.openNow
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-700'
                  )}>
                    <span className={cn('w-1.5 h-1.5 rounded-full', detail.openNow ? 'bg-green-500' : 'bg-red-500')} />
                    {detail.openNow ? 'Open now' : 'Closed now'}
                  </div>
                )}

                {/* Today's hours */}
                {detail.openingHours && detail.openingHours.length > 0 && (() => {
                  const today = new Date().toLocaleDateString('en-US', { weekday: 'long' })
                  const todayLine = detail.openingHours.find(h => h.startsWith(today))
                  return todayLine ? (
                    <p className="text-xs text-muted-foreground">{todayLine}</p>
                  ) : null
                })()}

                {/* Full hours toggle */}
                {detail.openingHours && detail.openingHours.length > 0 && (
                  <details className="text-xs text-muted-foreground">
                    <summary className="cursor-pointer hover:text-foreground select-none">Full hours</summary>
                    <div className="mt-1.5 space-y-0.5 pl-1">
                      {detail.openingHours.map((h, i) => <p key={i}>{h}</p>)}
                    </div>
                  </details>
                )}

                {/* Phone */}
                {detail.phone && (
                  <a href={`tel:${detail.phone}`}
                    className="flex items-center gap-1.5 text-xs text-sky-600 hover:underline">
                    <Phone className="w-3 h-3" /> {detail.phone}
                  </a>
                )}

                {/* Website */}
                {detail.website && (
                  <a href={detail.website} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-sky-600 hover:underline min-w-0 overflow-hidden">
                    <ExternalLink className="w-3 h-3 shrink-0" />
                    <span className="truncate">{detail.website.replace(/^https?:\/\/(www\.)?/, '')}</span>
                  </a>
                )}

                {/* Rating & price */}
                {(detail.rating || detail.priceLevel) && (
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {detail.rating && <span>⭐ {detail.rating}</span>}
                    {detail.priceLevel && <span>{'£'.repeat(detail.priceLevel)}</span>}
                  </div>
                )}
              </>
            ) : (
              <p className="text-xs text-muted-foreground">No details available</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
