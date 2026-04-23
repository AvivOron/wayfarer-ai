import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { TripShell } from '@/components/TripShell'

export default async function TripPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/')

  const { id } = await params
  const trip = await prisma.trip.findFirst({
    where: { id, userId: session.user.id },
    include: { activities: { orderBy: [{ scheduledAt: 'asc' }, { sortOrder: 'asc' }] } },
  })

  if (!trip) notFound()

  return <TripShell trip={JSON.parse(JSON.stringify(trip))} />
}
