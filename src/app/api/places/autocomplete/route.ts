import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const input = searchParams.get('input')
  if (!input) return NextResponse.json({ predictions: [] })

  const url = new URL('https://maps.googleapis.com/maps/api/place/autocomplete/json')
  url.searchParams.set('input', input)
  const types = req.nextUrl.searchParams.get('types')
  if (types) url.searchParams.set('types', types)
  url.searchParams.set('key', process.env.GOOGLE_MAPS_API_KEY!)

  const res = await fetch(url.toString())
  const data = await res.json()

  const predictions = (data.predictions ?? []).map((p: { description: string }) => p.description)
  return NextResponse.json({ predictions })
}
