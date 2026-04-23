import { redirect } from 'next/navigation'

export default async function PlannerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/trips/${id}`)
}
