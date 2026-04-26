import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const address = new URL(req.url).searchParams.get('address')
  if (!address) return NextResponse.json({ error: 'address required' }, { status: 400 })

  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json')
  url.searchParams.set('address', address)
  url.searchParams.set('key', process.env.GOOGLE_MAPS_API_KEY!)

  const res = await fetch(url.toString())
  const data = await res.json()

  const loc = data.results?.[0]?.geometry?.location
  if (!loc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ lat: loc.lat, lng: loc.lng })
}
