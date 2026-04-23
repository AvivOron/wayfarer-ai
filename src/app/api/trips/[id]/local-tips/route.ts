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

  const tips = await prisma.localTips.findUnique({ where: { tripId: id } })
  return NextResponse.json(tips ?? null)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const trip = await verifyOwnership(id, session.user.id)
  if (!trip) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { sections } = await req.json()

  const tips = await prisma.localTips.upsert({
    where: { tripId: id },
    create: { tripId: id, sections },
    update: { sections },
  })

  return NextResponse.json(tips)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const trip = await verifyOwnership(id, session.user.id)
  if (!trip) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.localTips.deleteMany({ where: { tripId: id } })
  return NextResponse.json({ ok: true })
}
