import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { exploreArea } from '@/lib/gemini'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { area, destination, interests } = await req.json()

  try {
    const places = await exploreArea(area, destination, interests ?? [])
    return NextResponse.json({ places })
  } catch (err) {
    console.error('Area explore error:', err)
    return NextResponse.json({ error: 'Failed to explore area' }, { status: 500 })
  }
}
