import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { generatePackingList } from '@/lib/gemini'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()

  try {
    const categories = await generatePackingList(body)
    return NextResponse.json({ categories })
  } catch (err) {
    console.error('Packing list error:', err)
    return NextResponse.json({ error: 'Failed to generate packing list' }, { status: 500 })
  }
}
