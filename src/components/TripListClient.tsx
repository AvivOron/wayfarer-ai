'use client'

import Link from 'next/link'
import { signOut } from 'next-auth/react'
import { Plus, LogOut, MapPin, CalendarDays, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Trip, TripStatus } from '@/types'
import { format, isBefore, isWithinInterval, differenceInCalendarDays } from 'date-fns'
import Image from 'next/image'

interface Props {
  trips: Trip[]
  user: { name?: string | null; image?: string | null; email?: string | null }
}

const STATUS_COLORS: Record<TripStatus, string> = {
  planning: 'bg-sky-100 text-sky-700',
  active: 'bg-green-100 text-green-700',
  completed: 'bg-sand-200 text-sand-700',
}

function computeStatus(trip: Trip): TripStatus {
  const now = new Date()
  const start = new Date(trip.startDate)
  const end = new Date(trip.endDate)
  if (isWithinInterval(now, { start, end })) return 'active'
  if (isBefore(now, start)) return 'planning'
  return 'completed'
}

export function TripListClient({ trips, user }: Props) {
  const grouped = {
    active: trips.filter(t => computeStatus(t) === 'active'),
    planning: trips.filter(t => computeStatus(t) === 'planning'),
    completed: trips.filter(t => computeStatus(t) === 'completed'),
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-card border-b border-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">✈️</span>
          <span className="font-bold text-foreground">Wayfarer</span>
        </div>
        <div className="flex items-center gap-2">
          {user.image && (
            <Image
              src={user.image}
              alt={user.name ?? 'User'}
              width={32}
              height={32}
              className="rounded-full"
            />
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => signOut({ callbackUrl: '/wayfarer-ai' })}
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 px-4 py-6 max-w-2xl mx-auto w-full">
        <div className="flex items-end justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">My Trips</h1>
            <p className="text-muted-foreground text-sm">
              {user.name ? `Welcome back, ${user.name.split(' ')[0]}!` : 'Your adventures'}
            </p>
          </div>
          <Button asChild className="bg-sky-500 hover:bg-sky-600 rounded-2xl gap-2">
            <Link href="/trips/new">
              <Plus className="w-4 h-4" />
              New Trip
            </Link>
          </Button>
        </div>

        {trips.length === 0 && (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">🗺️</div>
            <h2 className="text-xl font-semibold mb-2">No trips yet</h2>
            <p className="text-muted-foreground mb-6">Start planning your first adventure!</p>
            <Button asChild className="bg-sky-500 hover:bg-sky-600 rounded-2xl">
              <Link href="/trips/new">Plan a Trip</Link>
            </Button>
          </div>
        )}

        {grouped.active.length > 0 && (
          <TripSection title="Ongoing" trips={grouped.active} />
        )}
        {grouped.planning.length > 0 && (
          <TripSection title="Upcoming" trips={grouped.planning} />
        )}
        {grouped.completed.length > 0 && (
          <TripSection title="Past" trips={grouped.completed} />
        )}
      </main>
    </div>
  )
}

function TripSection({ title, trips }: { title: string; trips: Trip[] }) {
  return (
    <section className="mb-8">
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">{title}</h2>
      <div className="flex flex-col gap-3">
        {trips.map(trip => (
          <TripCard key={trip.id} trip={trip} />
        ))}
      </div>
    </section>
  )
}

function TripCard({ trip }: { trip: Trip }) {
  const status = computeStatus(trip)
  const nights = Math.round(
    (new Date(trip.endDate).getTime() - new Date(trip.startDate).getTime()) / 86400000
  )
  const daysUntil = status === 'planning'
    ? differenceInCalendarDays(new Date(trip.startDate), new Date())
    : null

  return (
    <Link href={`/trips/${trip.id}`}>
      <div className="bg-card border border-border rounded-2xl p-4 hover:border-primary/50 transition-all hover:shadow-md active:scale-[0.99]">
        <div className="flex items-start justify-between mb-2">
          <div>
            <h3 className="font-semibold text-base">{trip.title}</h3>
            <div className="flex items-center gap-1 text-muted-foreground text-sm">
              <MapPin className="w-3 h-3" />
              {trip.destination}
            </div>
          </div>
          <Badge className={STATUS_COLORS[status] + ' text-xs rounded-full'}>
            {status === 'active' ? '🟢 Live' : status === 'planning' ? 'Upcoming' : 'Done'}
          </Badge>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground mt-3">
          <span className="flex items-center gap-1">
            <CalendarDays className="w-3 h-3" />
            {format(new Date(trip.startDate), 'MMM d')} – {format(new Date(trip.endDate), 'MMM d, yyyy')}
          </span>
          <span className="flex items-center gap-1">
            <Users className="w-3 h-3" />
            {trip.groupSize} {trip.groupType}
          </span>
          <span>{nights} night{nights !== 1 ? 's' : ''}</span>
        </div>
        {trip.interests.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {trip.interests.slice(0, 3).map(i => (
              <span key={i} className="text-xs bg-muted px-2 py-0.5 rounded-full">{i}</span>
            ))}
          </div>
        )}
        {daysUntil !== null && (
          <div className="mt-3 pt-3 border-t border-border flex items-center justify-center gap-1.5">
            <span className="text-2xl font-black tabular-nums text-sky-500">{daysUntil}</span>
            <span className="text-xs text-muted-foreground">{daysUntil === 1 ? 'day' : 'days'} to go</span>
          </div>
        )}
      </div>
    </Link>
  )
}
