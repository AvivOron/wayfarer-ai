import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { sessionCookieName } from '@/lib/auth-cookies'

const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET || '')

// Build a public-facing URL from NEXTAUTH_URL + the request pathname+search,
// so the callbackUrl never leaks the internal Vercel deployment hostname.
function publicUrl(request: NextRequest): string {
  const base = process.env.NEXTAUTH_URL
    ? new URL(process.env.NEXTAUTH_URL).origin
    : request.nextUrl.origin
  const { pathname, search } = request.nextUrl
  return `${base}${pathname}${search}`
}

export async function middleware(request: NextRequest) {
  const token = request.cookies.get(sessionCookieName)?.value

  if (!token) {
    const signInUrl = new URL('/wayfarer-ai', publicUrl(request))
    signInUrl.searchParams.set('callbackUrl', publicUrl(request))
    return NextResponse.redirect(signInUrl)
  }

  try {
    await jwtVerify(token, secret)
    return NextResponse.next()
  } catch {
    const signInUrl = new URL('/wayfarer-ai', publicUrl(request))
    signInUrl.searchParams.set('callbackUrl', publicUrl(request))
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
