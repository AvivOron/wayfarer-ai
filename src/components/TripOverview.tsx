'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, MapPin, CalendarDays, Users, Plane,
  Map, Zap, CalendarCheck, Trash2, Loader2, Pencil
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Trip, TRANSPORT_OPTIONS } from '@/types'
import { format, differenceInDays } from 'date-fns'
import { toast } from 'sonner'
import { WeatherWidget } from '@/components/WeatherWidget'
import { TripEditSheet } from '@/components/TripEditSheet'

interface Props {
  trip: Trip
  onTripUpdate?: (t: Trip) => void
  onTabSwitch?: (tab: string) => void
}

export function TripOverview({ trip: initialTrip, onTripUpdate, onTabSwitch }: Props) {
  const router = useRouter()
  const [trip, setTrip] = useState(initialTrip)
  const [showEdit, setShowEdit] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const nights = differenceInDays(new Date(trip.endDate), new Date(trip.startDate))
  const visited = (trip.activities ?? []).filter(a => a.visited).length
  const total = (trip.activities ?? []).length
  const transportEmoji = TRANSPORT_OPTIONS.find(t => t.value === trip.transport)?.emoji ?? '🚇'

  async function handleDelete() {
    if (!confirm('Delete this trip and all its activities?')) return
    setDeleting(true)
    const res = await fetch(`/wayfarer-ai/api/trips/${trip.id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Trip deleted')
      router.push('/app')
    } else {
      toast.error('Failed to delete trip')
      setDeleting(false)
    }
  }

  return (
    <div>
      {/* Hero header */}
      <div className="bg-gradient-to-br from-sky-500 to-ocean-700 text-white px-4 py-6 safe-pt">
        <div className="flex items-center justify-between mb-4">
          <Button
            variant="ghost"
            size="icon"
            asChild
            className="text-white/80 hover:text-white hover:bg-white/10"
          >
            <Link href="/app">
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Button>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="text-white/80 hover:text-white hover:bg-white/10"
              onClick={() => setShowEdit(true)}
            >
              <Pencil className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-white/80 hover:text-white hover:bg-white/10"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        <h1 className="text-2xl font-bold mb-1">{trip.title}</h1>
        <div className="flex items-center gap-1 text-white/80 text-sm mb-4">
          <MapPin className="w-3.5 h-3.5" />
          {trip.destination}
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge className="bg-white/20 text-white border-0 backdrop-blur rounded-full">
            <CalendarDays className="w-3 h-3 mr-1" />
            {format(new Date(trip.startDate), 'MMM d')} – {format(new Date(trip.endDate), 'MMM d')}
          </Badge>
          <Badge className="bg-white/20 text-white border-0 backdrop-blur rounded-full">
            <Plane className="w-3 h-3 mr-1" />
            {nights} nights
          </Badge>
          <Badge className="bg-white/20 text-white border-0 backdrop-blur rounded-full">
            <Users className="w-3 h-3 mr-1" />
            {trip.groupSize} {trip.groupType}
          </Badge>
          <Badge className="bg-white/20 text-white border-0 backdrop-blur rounded-full">
            {transportEmoji} {trip.transport}
          </Badge>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-6 space-y-6">
        {/* Progress */}
        {total > 0 && (
          <div className="bg-card border border-border rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Activities visited</span>
              <span className="text-sm text-muted-foreground">{visited}/{total}</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className="bg-sky-500 h-2 rounded-full transition-all"
                style={{ width: total > 0 ? `${(visited / total) * 100}%` : '0%' }}
              />
            </div>
          </div>
        )}

        {/* Weather */}
        <WeatherWidget
          lat={trip.lat}
          lng={trip.lng}
          destination={trip.destination}
          startDate={trip.startDate.split('T')[0]}
          endDate={trip.endDate.split('T')[0]}
        />

        {/* Quick links */}
        <div className="grid grid-cols-3 gap-3">
          <button onClick={() => onTabSwitch?.('planner')} className="flex flex-col items-center gap-2 p-4 bg-card border border-border rounded-2xl hover:border-primary/50 transition-all">
            <Map className="w-6 h-6 text-sky-500" />
            <span className="text-xs font-medium">Planner</span>
          </button>
          <button onClick={() => onTabSwitch?.('live')} className="flex flex-col items-center gap-2 p-4 bg-card border border-border rounded-2xl hover:border-primary/50 transition-all">
            <Zap className="w-6 h-6 text-sunset-500" />
            <span className="text-xs font-medium">Live Mode</span>
          </button>
          <button onClick={() => onTabSwitch?.('itinerary')} className="flex flex-col items-center gap-2 p-4 bg-card border border-border rounded-2xl hover:border-primary/50 transition-all">
            <CalendarCheck className="w-6 h-6 text-green-500" />
            <span className="text-xs font-medium">Itinerary</span>
          </button>
        </div>

        {/* Interests */}
        {trip.interests.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Interests</h2>
            <div className="flex flex-wrap gap-2">
              {trip.interests.map(i => (
                <Badge key={i} variant="secondary" className="rounded-full">{i}</Badge>
              ))}
            </div>
          </div>
        )}

        {/* Recent activities preview */}
        {total > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Activities</h2>
              <Link href={`/trips/${trip.id}/itinerary`} className="text-xs text-primary">View all</Link>
            </div>
            <div className="space-y-2">
              {(trip.activities ?? []).slice(0, 3).map(a => (
                <div key={a.id} className="flex items-center gap-3 p-3 bg-card border border-border rounded-xl">
                  <div className={`w-2 h-2 rounded-full ${a.visited ? 'bg-green-500' : 'bg-muted-foreground/40'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{a.name}</p>
                    {a.scheduledAt && (
                      <p className="text-xs text-muted-foreground">{format(new Date(a.scheduledAt), 'MMM d, HH:mm')}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {showEdit && (
        <TripEditSheet
          trip={trip}
          onClose={() => setShowEdit(false)}
          onSaved={updated => { setTrip(updated); onTripUpdate?.(updated) }}
        />
      )}
    </div>
  )
}
