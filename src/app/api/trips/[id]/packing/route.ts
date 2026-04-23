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

  const packing = await prisma.packingList.findUnique({ where: { tripId: id } })
  return NextResponse.json(packing ?? null)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const trip = await verifyOwnership(id, session.user.id)
  if (!trip) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { categories, checked } = await req.json()

  const packing = await prisma.packingList.upsert({
    where: { tripId: id },
    create: { tripId: id, categories, checked: checked ?? [] },
    update: { categories, checked: checked ?? [] },
  })

  return NextResponse.json(packing)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const trip = await verifyOwnership(id, session.user.id)
  if (!trip) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.packingList.deleteMany({ where: { tripId: id } })
  return NextResponse.json({ ok: true })
}
