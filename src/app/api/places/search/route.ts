import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { searchPlaces } from '@/lib/places'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')
  const lat = searchParams.get('lat')
  const lng = searchParams.get('lng')
  const destination = searchParams.get('destination')

  if (!q) return NextResponse.json({ error: 'Query required' }, { status: 400 })

  try {
    const results = await searchPlaces(
      q,
      lat ? parseFloat(lat) : undefined,
      lng ? parseFloat(lng) : undefined,
      destination ?? undefined
    )
    return NextResponse.json({ results })
  } catch (err) {
    console.error('Places search error:', err)
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
}
