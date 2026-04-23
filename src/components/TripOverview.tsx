'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, MapPin, CalendarDays, Users, Plane,
  Trash2, Loader2, Pencil
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Trip, TRANSPORT_OPTIONS } from '@/types'
import { format, differenceInDays, differenceInCalendarDays } from 'date-fns'
import { toast } from 'sonner'
import { WeatherWidget } from '@/components/WeatherWidget'
import { TripEditSheet } from '@/components/TripEditSheet'
import { PreTripChecklist } from '@/components/PreTripChecklist'

// Curated Unsplash photo IDs for popular destinations
const DESTINATION_PHOTOS: Record<string, string> = {
  'london':        'photo-1505761671935-60b3a7427bad',
  'paris':         'photo-1499856871958-5b9627545d1a',
  'new york':      'photo-1534430480872-3498386e7856',
  'tokyo':         'photo-1540959733332-eab4deabeeaf',
  'amsterdam':     'photo-1534351590666-13e3e96b5017',
  'barcelona':     'photo-1583422409516-2895a77efded',
  'rome':          'photo-1552832230-c0197dd311b5',
  'dubai':         'photo-1512453979798-5ea266f8880c',
  'singapore':     'photo-1525625293386-3f8f99389edd',
  'sydney':        'photo-1506973035872-a4ec16b8e8d9',
  'los angeles':   'photo-1580655653885-65763b2597d0',
  'miami':         'photo-1506905925346-21bda4d32df4',
  'san francisco': 'photo-1501594907352-04cda38ebc29',
  'chicago':       'photo-1477959858617-67f85cf4f1df',
  'berlin':        'photo-1560969184-10fe8719e047',
  'madrid':        'photo-1539037116277-4db20889f2d4',
  'lisbon':        'photo-1555881400-74d7acaacd8b',
  'prague':        'photo-1541849546-216549ae216d',
  'vienna':        'photo-1516550893923-42d28e5677af',
  'budapest':      'photo-1539037116277-4db20889f2d4',
  'athens':        'photo-1555993539-1732b0258235',
  'istanbul':      'photo-1524231757912-21f4fe3a7200',
  'bangkok':       'photo-1508009603885-50cf7c579365',
  'bali':          'photo-1537996194471-e657df975ab4',
  'hong kong':     'photo-1506970845246-18f21d533b20',
  'seoul':         'photo-1538485399081-7191377e8241',
  'beijing':       'photo-1508804185872-d7badad00f7d',
  'tel aviv':      'photo-1544216717-3bbf52512659',
  'jerusalem':     'photo-1552423310-bd69d4cb939e',
  'cairo':         'photo-1539650116574-75c0c6d73f6e',
  'cape town':     'photo-1580060839134-75a5edca2e99',
  'toronto':       'photo-1517090504586-fde19ea6066f',
  'mexico city':   'photo-1518638150340-f706e86654de',
  'rio de janeiro':'photo-1483729558449-99ef09a8c325',
  'buenos aires':  'photo-1589909202802-8f4aadce1849',
  'edinburgh':     'photo-1506377585622-bedcbb027afc',
  'florence':      'photo-1534445967719-8ae7b972b1a5',
  'venice':        'photo-1523906834658-6e24ef2386f9',
  'amalfi':        'photo-1533104816931-20fa691ff6ca',
  'santorini':     'photo-1602002418082-a4443e081dd1',
  'maldives':      'photo-1514282401047-d79a71a590e8',
  'tuscany':       'photo-1516483638261-f4dbaf036963',
  'alps':          'photo-1531366936337-7c912a4589a7',
  'kyoto':         'photo-1528360983277-13d401cdc186',
  'osaka':         'photo-1590559899731-a382839e5549',
}

function getDestinationPhoto(destination: string): string {
  const key = destination.toLowerCase().trim()
  // Try exact match first, then partial match
  const exactId = DESTINATION_PHOTOS[key]
  if (exactId) return `https://images.unsplash.com/${exactId}?auto=format&fit=crop&w=1200&q=90`

  const partialKey = Object.keys(DESTINATION_PHOTOS).find(k => key.includes(k) || k.includes(key.split(',')[0].trim()))
  if (partialKey) return `https://images.unsplash.com/${DESTINATION_PHOTOS[partialKey]}?auto=format&fit=crop&w=1200&q=90`

  // Fallback: generic travel photo (source.unsplash.com is deprecated and unreliable)
  return `https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=1200&q=90`
}

interface Props {
  trip: Trip
  onTripUpdate?: (t: Trip) => void
}

export function TripOverview({ trip: initialTrip, onTripUpdate }: Props) {
  const router = useRouter()
  const [trip, setTrip] = useState(initialTrip)
  const [showEdit, setShowEdit] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [photoUrl, setPhotoUrl] = useState(() => getDestinationPhoto(trip.destination))
  const fallbackPhoto = 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=1200&q=90'
  const nights = differenceInDays(new Date(trip.endDate), new Date(trip.startDate))
  const visited = (trip.activities ?? []).filter(a => a.visited).length
  const total = (trip.activities ?? []).length
  const transportEmoji = TRANSPORT_OPTIONS.find(t => t.value === trip.transport)?.emoji ?? '🚇'
  const daysUntil = differenceInCalendarDays(new Date(trip.startDate), new Date())
  const tripStarted = daysUntil <= 0 && differenceInCalendarDays(new Date(trip.endDate), new Date()) >= 0
  const tripEnded = differenceInCalendarDays(new Date(trip.endDate), new Date()) < 0

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
      <div className="relative text-white px-4 py-6 safe-pt overflow-hidden flex flex-col" style={{ minHeight: 220 }}>
        {/* Background photo */}
        <Image
          src={photoUrl}
          alt={trip.destination}
          fill
          className="object-cover object-center"
          priority
          sizes="100vw"
          onError={() => setPhotoUrl(fallbackPhoto)}
        />
        {/* Dark overlay for readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/40 to-black/70" />
        {/* Content above overlays */}
        <div className="relative z-10 flex flex-col flex-1">
          {/* Top nav row */}
          <div className="flex items-center justify-between">
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

          {/* Spacer pushes title+pills to bottom */}
          <div className="flex-1" />

          {/* Title + pills pinned to bottom */}
          <div className="pb-1">
            <h1 className="text-2xl font-bold mb-1 drop-shadow">{trip.title}</h1>
            <div className="flex items-center gap-1 text-white/80 text-sm mb-3">
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

        {/* Countdown */}
        {!tripEnded && !tripStarted && (
          <div className="relative overflow-hidden bg-gradient-to-br from-sky-500/10 via-sky-400/5 to-transparent border border-sky-500/20 rounded-2xl p-5">
            <div className="absolute -top-6 -right-6 w-32 h-32 bg-sky-500/10 rounded-full blur-2xl pointer-events-none" />
            <p className="text-xs font-semibold text-sky-500 uppercase tracking-widest mb-3 text-center">Countdown</p>
            <div className="flex flex-col items-center">
              <span className="text-7xl font-black tabular-nums leading-none text-sky-500">{daysUntil}</span>
              <span className="text-xl font-semibold text-muted-foreground mt-1">{daysUntil === 1 ? 'day' : 'days'}</span>
            </div>
            <p className="text-sm text-muted-foreground mt-3 text-center">until your trip to <span className="text-foreground font-medium">{trip.destination.split(',')[0]}</span></p>
          </div>
        )}
        {tripStarted && (
          <div className="relative overflow-hidden bg-gradient-to-br from-green-500/10 via-green-400/5 to-transparent border border-green-500/20 rounded-2xl p-5 text-center">
            <p className="text-4xl mb-1">✈️</p>
            <p className="text-lg font-bold text-green-500">You&apos;re on this trip!</p>
            <p className="text-sm text-muted-foreground mt-1">Enjoy {trip.destination.split(',')[0]}</p>
          </div>
        )}
        {tripEnded && (
          <div className="relative overflow-hidden bg-gradient-to-br from-amber-500/10 via-amber-400/5 to-transparent border border-amber-500/20 rounded-2xl p-5 text-center">
            <p className="text-4xl mb-1">🎉</p>
            <p className="text-lg font-bold">Trip completed!</p>
            <p className="text-sm text-muted-foreground mt-1">Hope you had an amazing time</p>
          </div>
        )}

        {/* Pre-trip checklist */}
        {!tripEnded && (
          <PreTripChecklist trip={trip} />
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
