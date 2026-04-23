import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { generatePreTripChecklist } from '@/lib/gemini'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()

  try {
    const items = await generatePreTripChecklist(body)
    return NextResponse.json({ items })
  } catch (err) {
    console.error('Pre-trip checklist error:', err)
    return NextResponse.json({ error: 'Failed to generate checklist' }, { status: 500 })
  }
}
