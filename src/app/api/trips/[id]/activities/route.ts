import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { searchPlaces } from '@/lib/places'

const SKIP_GEOCODE_PATTERNS = /breakfast|lunch|dinner|check.?in|check.?out|hotel|accommodation|hostel|airbnb/i

async function geocodeAddress(name: string, address: string, destination: string): Promise<{ lat: number; lng: number; placeId: string } | null> {
  // Skip generic hotel/meal activities — they'd return wrong results
  if (SKIP_GEOCODE_PATTERNS.test(name)) return null
  // Skip if address is just the destination city name (too vague)
  if (!address || address.trim().toLowerCase() === destination.trim().toLowerCase()) return null

  try {
    const query = `${name} ${address}`
    const results = await searchPlaces(query, undefined, undefined, destination)
    if (results.length > 0) {
      return { lat: results[0].lat, lng: results[0].lng, placeId: results[0].placeId }
    }
  } catch {
    // geocoding is best-effort
  }
  return null
}

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const trip = await prisma.trip.findFirst({ where: { id, userId: session.user.id } })
  if (!trip) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const activities = await prisma.activity.findMany({
    where: { tripId: id },
    orderBy: [{ scheduledAt: 'asc' }, { sortOrder: 'asc' }],
  })
  return NextResponse.json(activities)
}

export async function POST(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const trip = await prisma.trip.findFirst({ where: { id, userId: session.user.id } })
  if (!trip) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()

  // Support bulk insert for AI-generated schedules
  if (Array.isArray(body)) {
    // Geocode activities that have an address but no coordinates (AI-generated)
    const geocoded = await Promise.all(
      body.map(async (a) => {
        if (a.lat && a.lng) return a
        if (!a.address && !a.name) return a
        const geo = await geocodeAddress(a.name, a.address ?? '', trip.destination)
        return geo ? { ...a, lat: geo.lat, lng: geo.lng, placeId: a.placeId ?? geo.placeId } : a
      })
    )

    const activities = await prisma.activity.createMany({
      data: geocoded.map((a, i) => ({
        tripId: id,
        placeId: a.placeId ?? null,
        name: a.name,
        address: a.address ?? null,
        lat: a.lat ?? null,
        lng: a.lng ?? null,
        category: a.category ?? 'attraction',
        scheduledAt: a.scheduledAt ? new Date(a.scheduledAt) : null,
        durationMins: a.durationMins ?? null,
        notes: a.notes ?? null,
        groupLabel: a.groupLabel ?? null,
        aiGenerated: a.aiGenerated ?? false,
        sortOrder: a.sortOrder ?? i,
      })),
    })
    return NextResponse.json(activities, { status: 201 })
  }

  const activity = await prisma.activity.create({
    data: {
      tripId: id,
      placeId: body.placeId ?? null,
      name: body.name,
      address: body.address ?? null,
      lat: body.lat ?? null,
      lng: body.lng ?? null,
      category: body.category ?? 'attraction',
      scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null,
      durationMins: body.durationMins ?? null,
      notes: body.notes ?? null,
      aiGenerated: body.aiGenerated ?? false,
      sortOrder: body.sortOrder ?? 0,
    },
  })

  return NextResponse.json(activity, { status: 201 })
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const trip = await prisma.trip.findFirst({ where: { id, userId: session.user.id } })
  if (!trip) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const { activityId, ...data } = body

  const activity = await prisma.activity.update({
    where: { id: activityId },
    data: {
      ...data,
      scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : undefined,
    },
  })

  return NextResponse.json(activity)
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const trip = await prisma.trip.findFirst({ where: { id, userId: session.user.id } })
  if (!trip) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { searchParams } = new URL(req.url)
  const activityId = searchParams.get('activityId')
  if (!activityId) return NextResponse.json({ error: 'activityId required' }, { status: 400 })

  await prisma.activity.delete({ where: { id: activityId } })
  return NextResponse.json({ success: true })
}
