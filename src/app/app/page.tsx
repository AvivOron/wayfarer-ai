import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { TripListClient } from '@/components/TripListClient'

export default async function AppPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/')

  const now = new Date()
  const [upcoming, past] = await Promise.all([
    prisma.trip.findMany({
      where: { userId: session.user.id, endDate: { gte: now } },
      orderBy: { startDate: 'asc' },
    }),
    prisma.trip.findMany({
      where: { userId: session.user.id, endDate: { lt: now } },
      orderBy: { startDate: 'desc' },
    }),
  ])
  const trips = [...upcoming, ...past]

  return <TripListClient trips={JSON.parse(JSON.stringify(trips))} user={session.user} />
}
