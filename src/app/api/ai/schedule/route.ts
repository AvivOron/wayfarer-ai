import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { generateSchedule, ScheduleContext } from '@/lib/gemini'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ctx: ScheduleContext = await req.json()

  try {
    const schedule = await generateSchedule(ctx)
    return NextResponse.json({ schedule })
  } catch (err) {
    console.error('Schedule generation error:', err)
    return NextResponse.json({ error: 'Failed to generate schedule' }, { status: 500 })
  }
}
