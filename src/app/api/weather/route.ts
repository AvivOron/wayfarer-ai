import { NextRequest, NextResponse } from 'next/server'
import { weatherCodeToInfo } from '@/types'

interface WeatherCoords {
  lat: string
  lng: string
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const lat = searchParams.get('lat')
  const lng = searchParams.get('lng')
  const destination = searchParams.get('destination')
  const startDate = searchParams.get('startDate')
  const endDate = searchParams.get('endDate')

  if ((!lat || !lng) && !destination) {
    return NextResponse.json({ error: 'lat/lng or destination required' }, { status: 400 })
  }

  if (!startDate || !endDate) {
    return NextResponse.json({ error: 'startDate and endDate required' }, { status: 400 })
  }

  const coords = lat && lng
    ? { lat, lng }
    : await geocodeDestination(destination!)

  if (!coords) {
    return NextResponse.json({ error: 'Destination weather location unavailable' }, { status: 502 })
  }

  const forecastWindow = getSupportedForecastWindow()
  if (startDate > forecastWindow.maxDate) {
    const climateSummary = await getClimateSummary(coords, startDate, endDate)
    return NextResponse.json({
      days: [],
      climateSummary,
      unavailableReason: climateSummary
        ? null
        : `Forecasts are available within 16 days of travel. Check back closer to ${formatDisplayDate(startDate)}.`,
    })
  }

  const url = new URL('https://api.open-meteo.com/v1/forecast')
  url.searchParams.set('latitude', coords.lat)
  url.searchParams.set('longitude', coords.lng)
  url.searchParams.set('daily', 'weathercode,temperature_2m_max,temperature_2m_min')
  url.searchParams.set('start_date', startDate)
  url.searchParams.set('end_date', endDate > forecastWindow.maxDate ? forecastWindow.maxDate : endDate)
  url.searchParams.set('timezone', 'auto')

  const res = await fetch(url.toString())
  const data = await res.json()

  if (!data.daily) {
    return NextResponse.json({
      days: [],
      unavailableReason: 'Weather forecast is unavailable for these dates.',
    })
  }

  const days = data.daily.time.map((date: string, i: number) => {
    const code = data.daily.weathercode[i]
    return {
      date,
      maxTemp: Math.round(data.daily.temperature_2m_max[i]),
      minTemp: Math.round(data.daily.temperature_2m_min[i]),
      weatherCode: code,
      ...weatherCodeToInfo(code),
    }
  })

  return NextResponse.json({ days })
}

function getSupportedForecastWindow() {
  const today = new Date()
  const max = new Date(today)
  max.setDate(today.getDate() + 16)

  return {
    maxDate: toDateKey(max),
  }
}

function toDateKey(date: Date): string {
  return date.toISOString().split('T')[0]
}

function formatDisplayDate(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString('en', {
    month: 'short',
    day: 'numeric',
  })
}

async function getClimateSummary(coords: WeatherCoords, startDate: string, endDate: string) {
  const url = new URL('https://climate-api.open-meteo.com/v1/climate')
  url.searchParams.set('latitude', coords.lat)
  url.searchParams.set('longitude', coords.lng)
  url.searchParams.set('start_date', clampClimateDate(startDate))
  url.searchParams.set('end_date', clampClimateDate(endDate))
  url.searchParams.set('models', 'EC_Earth3P_HR')
  url.searchParams.set('daily', 'temperature_2m_max,temperature_2m_min,precipitation_sum')

  const res = await fetch(url.toString())
  const data = await res.json()
  const daily = data.daily
  if (!daily?.temperature_2m_max?.length || !daily?.temperature_2m_min?.length) return null

  const maxTemps = daily.temperature_2m_max.filter(isNumber)
  const minTemps = daily.temperature_2m_min.filter(isNumber)
  const precipitation = (daily.precipitation_sum ?? []).filter(isNumber)
  if (maxTemps.length === 0 || minTemps.length === 0) return null

  const avgMax = Math.round(average(maxTemps))
  const avgMin = Math.round(average(minTemps))
  const wetDays = precipitation.filter((mm: number) => mm >= 1).length

  return {
    dateRange: `${formatDisplayDate(startDate)}-${formatDisplayDate(endDate)}`,
    avgMax,
    avgMin,
    wetDays,
    totalDays: daily.time?.length ?? maxTemps.length,
  }
}

function clampClimateDate(date: string): string {
  return date > '2050-01-01' ? '2050-01-01' : date
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

async function geocodeDestination(destination: string): Promise<WeatherCoords | null> {
  const url = new URL('https://geocoding-api.open-meteo.com/v1/search')
  url.searchParams.set('name', destination)
  url.searchParams.set('count', '1')
  url.searchParams.set('language', 'en')
  url.searchParams.set('format', 'json')

  const res = await fetch(url.toString())
  const data = await res.json()
  const result = data.results?.[0]
  if (!result) return null

  return {
    lat: String(result.latitude),
    lng: String(result.longitude),
  }
}
