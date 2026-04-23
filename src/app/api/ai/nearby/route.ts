import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { generateNearbyRecommendations, NearbyContext } from '@/lib/gemini'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ctx: NearbyContext = await req.json()

  try {
    const recommendations = await generateNearbyRecommendations(ctx)
    return NextResponse.json({ recommendations })
  } catch (err) {
    console.error('Nearby AI error:', err)
    return NextResponse.json({ error: 'Failed to get recommendations' }, { status: 500 })
  }
}
