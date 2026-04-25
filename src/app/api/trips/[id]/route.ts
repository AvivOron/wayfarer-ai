import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const trip = await prisma.trip.findFirst({
    where: { id, userId: session.user.id },
    include: { activities: { orderBy: [{ scheduledAt: 'asc' }, { sortOrder: 'asc' }] } },
  })

  if (!trip) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(trip)
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const existing = await prisma.trip.findFirst({ where: { id, userId: session.user.id } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const {
    title, destination, lat, lng, startDate, endDate,
    hotelAddress, hotelLat, hotelLng, accommodationType, transport, groupType,
    groupSize, childAges, interests, foodPreferences, dietaryRestrictions, notes,
  } = await req.json()

  const trip = await prisma.trip.update({
    where: { id },
    data: {
      title, destination, lat, lng,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      hotelAddress, hotelLat, hotelLng, accommodationType, transport, groupType,
      groupSize, childAges, interests, foodPreferences, dietaryRestrictions, notes,
    },
    include: { activities: { orderBy: [{ scheduledAt: 'asc' }, { sortOrder: 'asc' }] } },
  })

  return NextResponse.json(trip)
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const existing = await prisma.trip.findFirst({ where: { id, userId: session.user.id } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.trip.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
