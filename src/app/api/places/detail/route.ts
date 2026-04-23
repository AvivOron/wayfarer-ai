import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getPlaceDetail } from '@/lib/places'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const placeId = new URL(req.url).searchParams.get('placeId')
  if (!placeId) return NextResponse.json({ error: 'placeId required' }, { status: 400 })

  try {
    const detail = await getPlaceDetail(placeId)
    return NextResponse.json(detail)
  } catch (err) {
    console.error('Place detail error:', err)
    return NextResponse.json({ error: 'Failed to fetch details' }, { status: 500 })
  }
}
