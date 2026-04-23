'use client'

import { useEffect, useState } from 'react'
import { WeatherDay } from '@/types'

interface ClimateSummary {
  dateRange: string
  avgMax: number
  avgMin: number
  wetDays: number
  totalDays: number
}

interface Props {
  lat?: number | null
  lng?: number | null
  destination: string
  startDate: string
  endDate: string
}

export function WeatherWidget({ lat, lng, destination, startDate, endDate }: Props) {
  const [days, setDays] = useState<WeatherDay[]>([])
  const [climateSummary, setClimateSummary] = useState<ClimateSummary | null>(null)
  const [unavailableReason, setUnavailableReason] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    setClimateSummary(null)
    setUnavailableReason(null)
    const params = new URLSearchParams({ destination, startDate, endDate })
    if (lat != null && lng != null) {
      params.set('lat', String(lat))
      params.set('lng', String(lng))
    }

    fetch(`/wayfarer-ai/api/weather?${params}`)
      .then(r => r.json())
      .then(d => {
        setDays(d.days ?? [])
        setClimateSummary(d.climateSummary ?? null)
        setUnavailableReason(d.unavailableReason ?? null)
      })
      .finally(() => setLoading(false))
  }, [lat, lng, destination, startDate, endDate])

  if (loading) return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <p className="text-sm text-muted-foreground animate-pulse">Loading weather forecast…</p>
    </div>
  )

  if (days.length === 0 && climateSummary) return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
        Typical Weather
      </h2>
      <p className="text-sm text-muted-foreground">
        Forecast is not available yet, but around {climateSummary.dateRange} it is usually {climateSummary.avgMin}°-{climateSummary.avgMax}° with about {climateSummary.wetDays} wet {climateSummary.wetDays === 1 ? 'day' : 'days'} over this length of stay.
      </p>
    </div>
  )

  if (days.length === 0 && unavailableReason) return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
        Weather Forecast
      </h2>
      <p className="text-sm text-muted-foreground">{unavailableReason}</p>
    </div>
  )

  if (days.length === 0) return null

  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
        Weather Forecast
      </h2>
      <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1">
        {days.map(d => (
          <div key={d.date} className="flex flex-col items-center min-w-[52px]">
            <span className="text-xs text-muted-foreground">
              {new Date(d.date + 'T12:00:00').toLocaleDateString('en', { weekday: 'short' })}
            </span>
            <span className="text-2xl my-1">{d.emoji}</span>
            <span className="text-xs font-semibold">{d.maxTemp}°</span>
            <span className="text-xs text-muted-foreground">{d.minTemp}°</span>
          </div>
        ))}
      </div>
    </div>
  )
}
