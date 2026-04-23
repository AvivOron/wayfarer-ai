import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { generateLocalTips } from '@/lib/gemini'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()

  try {
    const sections = await generateLocalTips(body)
    return NextResponse.json({ sections })
  } catch (err) {
    console.error('Local tips error:', err)
    return NextResponse.json({ error: 'Failed to generate local tips' }, { status: 500 })
  }
}
