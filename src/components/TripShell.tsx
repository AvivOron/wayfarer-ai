'use client'

import { useState } from 'react'
import { Trip } from '@/types'
import { TripOverview } from '@/components/TripOverview'
import { PlannerClient } from '@/components/PlannerClient'
import { ItineraryClient } from '@/components/ItineraryClient'
import { LiveModeClient } from '@/components/LiveModeClient'
import { PackingListSheet } from '@/components/PackingListSheet'
import { Home, Map, Zap, CalendarDays, Package } from 'lucide-react'
import { cn } from '@/lib/utils'

type Tab = 'overview' | 'planner' | 'packing' | 'itinerary' | 'live'

interface Props {
  trip: Trip
}

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'overview', label: 'Overview', icon: Home },
  { id: 'planner', label: 'Planner', icon: Map },
  { id: 'packing', label: 'Packing', icon: Package },
  { id: 'itinerary', label: 'Itinerary', icon: CalendarDays },
  { id: 'live', label: 'Live', icon: Zap },
]

export function TripShell({ trip: initialTrip }: Props) {
  const [tab, setTab] = useState<Tab>('overview')
  const [trip, setTrip] = useState(initialTrip)

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Tab content */}
      <div className={tab === 'overview' ? 'block' : 'hidden'}>
        <TripOverview trip={trip} onTripUpdate={setTrip} onTabSwitch={t => setTab(t as Tab)} />
      </div>
      <div className={tab === 'planner' ? 'block' : 'hidden'}>
        <PlannerClient trip={trip} />
      </div>
      <div className={tab === 'packing' ? 'block' : 'hidden'}>
        <PackingListSheet trip={trip} />
      </div>
      <div className={tab === 'itinerary' ? 'block' : 'hidden'}>
        <ItineraryClient trip={trip} />
      </div>
      <div className={tab === 'live' ? 'block' : 'hidden'}>
        <LiveModeClient trip={trip} />
      </div>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border safe-pb">
        <div className="flex items-center justify-around px-2 pt-2 pb-2">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                'flex flex-col items-center gap-1 px-3 py-1 rounded-xl transition-colors min-w-[52px]',
                tab === id ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <div className={cn(
                'w-10 h-6 flex items-center justify-center rounded-full transition-all',
                tab === id ? 'bg-primary/10' : ''
              )}>
                <Icon className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-medium">{label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}
