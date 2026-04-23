import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { TripListClient } from '@/components/TripListClient'

export default async function AppPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/')

  const trips = await prisma.trip.findMany({
    where: { userId: session.user.id },
    orderBy: { startDate: 'desc' },
  })

  return <TripListClient trips={JSON.parse(JSON.stringify(trips))} user={session.user} />
}
