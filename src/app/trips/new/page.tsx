import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { OnboardingWizard } from '@/components/OnboardingWizard'

export default async function NewTripPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/')
  return <OnboardingWizard />
}
