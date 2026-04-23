'use client'

import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { MapPin, Star, Plus, ExternalLink } from 'lucide-react'

interface Place {
  placeId: string
  name: string
  address: string
  lat: number
  lng: number
  rating?: number
  types: string[]
}

interface Props {
  place: Place
  onAdd: () => void
  onClose: () => void
}

const TYPE_LABELS: Record<string, string> = {
  restaurant: '🍽️ Restaurant',
  museum: '🏛️ Museum',
  park: '🌿 Park',
  lodging: '🏨 Hotel',
  tourist_attraction: '📍 Attraction',
  cafe: '☕ Cafe',
  bar: '🍺 Bar',
  art_gallery: '🎨 Gallery',
  shopping_mall: '🛍️ Shopping',
  point_of_interest: '⭐ Point of Interest',
}

function getTypeLabel(types: string[]): string {
  for (const t of types) {
    if (TYPE_LABELS[t]) return TYPE_LABELS[t]
  }
  return '📍 Place'
}

export function PlaceBottomSheet({ place, onAdd, onClose }: Props) {
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name)}&query_place_id=${place.placeId}`

  return (
    <Sheet open onOpenChange={open => !open && onClose()}>
      <SheetContent side="bottom" className="rounded-t-3xl pb-safe-area-bottom">
        <SheetHeader className="text-left mb-4">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 bg-sky-100 rounded-2xl flex items-center justify-center shrink-0">
              <MapPin className="w-6 h-6 text-sky-600" />
            </div>
            <div>
              <SheetTitle className="text-lg font-bold text-left">{place.name}</SheetTitle>
              <p className="text-sm text-muted-foreground mt-0.5">{getTypeLabel(place.types)}</p>
            </div>
          </div>
        </SheetHeader>

        <div className="space-y-4">
          <div className="flex items-start gap-2 text-sm text-muted-foreground">
            <MapPin className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{place.address}</span>
          </div>

          {place.rating && (
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map(n => (
                <Star
                  key={n}
                  className={`w-4 h-4 ${n <= Math.round(place.rating!) ? 'text-yellow-500 fill-yellow-500' : 'text-muted-foreground/30'}`}
                />
              ))}
              <span className="text-sm text-muted-foreground ml-1">{place.rating.toFixed(1)}</span>
            </div>
          )}

          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-primary"
          >
            <ExternalLink className="w-4 h-4" />
            Open in Google Maps
          </a>

          <Button
            className="w-full bg-sky-500 hover:bg-sky-600 rounded-2xl h-12 font-semibold gap-2"
            onClick={onAdd}
          >
            <Plus className="w-4 h-4" />
            Add to Must-See List
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
