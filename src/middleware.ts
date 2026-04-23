import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { sessionCookieName } from '@/lib/auth-cookies'

const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET || '')

export async function middleware(request: NextRequest) {
  const token = request.cookies.get(sessionCookieName)?.value

  if (!token) {
    const signInUrl = new URL('/wayfarer-ai', request.url)
    signInUrl.searchParams.set('callbackUrl', request.url)
    return NextResponse.redirect(signInUrl)
  }

  try {
    await jwtVerify(token, secret)
    return NextResponse.next()
  } catch {
    const signInUrl = new URL('/wayfarer-ai', request.url)
    signInUrl.searchParams.set('callbackUrl', request.url)
    return NextResponse.redirect(signInUrl)
  }
}

export const config = {
  matcher: [
    '/wayfarer-ai/app/:path*',
    '/wayfarer-ai/trips/:path*',
    '/wayfarer-ai/api/trips/:path*',
    '/wayfarer-ai/api/ai/:path*',
  ],
}
