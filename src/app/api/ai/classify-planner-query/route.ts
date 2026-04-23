import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { classifyPlannerQuery } from '@/lib/gemini'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { query, destination } = await req.json()

  try {
    const intent = await classifyPlannerQuery(query, destination)
    return NextResponse.json({ intent })
  } catch (err) {
    console.error('Planner query classification error:', err)
    return NextResponse.json({ error: 'Failed to classify query' }, { status: 500 })
  }
}
