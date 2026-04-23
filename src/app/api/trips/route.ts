import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const trips = await prisma.trip.findMany({
    where: { userId: session.user.id },
    include: { activities: { orderBy: { sortOrder: 'asc' } } },
    orderBy: { startDate: 'desc' },
  })

  return NextResponse.json(trips)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const {
    title, destination, lat, lng, startDate, endDate,
    hotelAddress, hotelLat, hotelLng, accommodationType, transport, groupType,
    groupSize, childAges, interests, foodPreferences, dietaryRestrictions,
  } = body

  const trip = await prisma.trip.create({
    data: {
      userId: session.user.id,
      title,
      destination,
      lat,
      lng,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      hotelAddress,
      hotelLat,
      hotelLng,
      accommodationType: accommodationType ?? 'hotel',
      transport: transport ?? 'public',
      groupType: groupType ?? 'solo',
      groupSize: groupSize ?? 1,
      childAges: childAges ?? [],
      interests: interests ?? [],
      foodPreferences: foodPreferences ?? [],
      dietaryRestrictions: dietaryRestrictions ?? [],
    },
  })

  return NextResponse.json(trip, { status: 201 })
}
