'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, Circle, Clock, ExternalLink, List, Loader2, Map as MapIcon, MapPin, Smile, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Trip, Activity } from '@/types'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { MemorySheet } from '@/components/MemorySheet'
import { ItineraryMap } from '@/components/ItineraryMap'

interface Props {
  trip: Trip
}

type GroupedDay = { date: Date; activities: Activity[] }

function groupByDay(activities: Activity[]): GroupedDay[] {
  const map = new Map<string, Activity[]>()
  for (const a of activities) {
    if (!a.scheduledAt) {
      const key = 'unscheduled'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(a)
      continue
    }
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

  const grouped = groupByDay(activities)
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
        <Header tripId={trip.id} destination={trip.destination} view={view} onViewChange={setView} />
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
      <Header tripId={trip.id} destination={trip.destination} view={view} onViewChange={setView} />
      {view === 'map' ? (
        <div style={{ height: 'calc(100vh - 57px - 72px)' }}>
          <ItineraryMap activities={activities} tripDestination={trip.destination} />
        </div>
      ) : (
      <div className="px-4 py-6 space-y-8">
        {grouped.map((day, di) => (
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
                {day.activities.map((activity) => (
                  <ActivityRow
                    key={activity.id}
                    activity={activity}
                    toggling={togglingId === activity.id}
                    deleting={deletingId === activity.id}
                    onToggle={toggleVisited}
                    onMemory={setMemoryActivity}
                    onDelete={deleteActivity}
                  />
                ))}
              </div>
            </div>
          </div>
        ))}
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
    </div>
  )
}

function Header({ destination, view, onViewChange }: {
  tripId: string
  destination: string
  view: 'list' | 'map'
  onViewChange: (v: 'list' | 'map') => void
}) {
  return (
    <div className="sticky top-0 z-40 bg-card border-b border-border px-4 py-3 flex items-center gap-3">
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
    </div>
  )
}

function ActivityRow({
  activity, toggling, deleting, onToggle, onMemory, onDelete,
}: {
  activity: Activity
  toggling: boolean
  deleting: boolean
  onToggle: (a: Activity) => void
  onMemory: (a: Activity) => void
  onDelete: (id: string) => void
}) {
  return (
    <div className="flex gap-3 pl-0">
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
        'flex-1 bg-card border rounded-2xl p-3 transition-all',
        activity.visited ? 'border-green-200 bg-green-50/50' : 'border-border',
      )}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className={cn('font-medium text-sm', activity.visited && 'line-through text-muted-foreground')}>
              {activity.name}
            </p>
            {activity.address && (
              <div className="flex items-center gap-1 mt-1">
                <MapPin className="w-3 h-3 text-muted-foreground shrink-0" />
                {activity.placeId ? (
                  <a
                    href={`https://www.google.com/maps/place/?q=place_id:${activity.placeId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-sky-600 hover:underline truncate flex items-center gap-0.5"
                    onClick={e => e.stopPropagation()}
                  >
                    {activity.address}
                    <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                  </a>
                ) : activity.lat && activity.lng ? (
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${activity.lat},${activity.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-sky-600 hover:underline truncate flex items-center gap-0.5"
                    onClick={e => e.stopPropagation()}
                  >
                    {activity.address}
                    <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                  </a>
                ) : (
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(activity.address)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-sky-600 hover:underline truncate flex items-center gap-0.5"
                    onClick={e => e.stopPropagation()}
                  >
                    {activity.address}
                    <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                  </a>
                )}
              </div>
            )}
            {activity.scheduledAt && (
              <div className="flex items-center gap-1 mt-1">
                <Clock className="w-3 h-3 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">
                  {format(new Date(activity.scheduledAt), 'HH:mm')}
                  {activity.durationMins && ` · ${activity.durationMins} min`}
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
              <button
                onClick={() => onMemory(activity)}
                className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground"
              >
                <Smile className="w-3.5 h-3.5" />
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
      </div>
    </div>
  )
}
