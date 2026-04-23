import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function verifyOwnership(tripId: string, userId: string) {
  return prisma.trip.findFirst({ where: { id: tripId, userId } })
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const trip = await verifyOwnership(id, session.user.id)
  if (!trip) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const checklist = await prisma.preTripChecklist.findUnique({ where: { tripId: id } })
  return NextResponse.json(checklist ?? null)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const trip = await verifyOwnership(id, session.user.id)
  if (!trip) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { items, checked } = await req.json()

  const checklist = await prisma.preTripChecklist.upsert({
    where: { tripId: id },
    create: { tripId: id, items, checked: checked ?? [] },
    update: { items, checked: checked ?? [] },
  })

  return NextResponse.json(checklist)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const trip = await verifyOwnership(id, session.user.id)
  if (!trip) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.preTripChecklist.deleteMany({ where: { tripId: id } })
  return NextResponse.json({ ok: true })
}
