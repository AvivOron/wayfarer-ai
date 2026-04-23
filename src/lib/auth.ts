import { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import { PrismaAdapter } from '@next-auth/prisma-adapter'
import { prisma } from './prisma'
import {
  callbackCookieName,
  csrfCookieName,
  isSecureAuthCookie,
  pkceCookieName,
  sessionCookieName,
  stateCookieName,
} from './auth-cookies'

export const authOptions: NextAuthOptions = {
  cookies: {
    sessionToken: { name: sessionCookieName, options: { httpOnly: true, sameSite: 'lax', path: '/', secure: isSecureAuthCookie } },
    callbackUrl: { name: callbackCookieName, options: { httpOnly: true, sameSite: 'lax', path: '/', secure: isSecureAuthCookie } },
    csrfToken: { name: csrfCookieName, options: { httpOnly: true, sameSite: 'lax', path: '/', secure: isSecureAuthCookie } },
    pkceCodeVerifier: { name: pkceCookieName, options: { httpOnly: true, sameSite: 'lax', path: '/', secure: isSecureAuthCookie } },
    state: { name: stateCookieName, options: { httpOnly: true, sameSite: 'lax', path: '/', secure: isSecureAuthCookie } },
  },
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true,
      authorization: {
        params: {
          redirect_uri: `${process.env.NEXTAUTH_URL}/callback/google`,
        },
      },
    }),
  ],
  session: { strategy: 'jwt' },
  callbacks: {
    jwt: ({ token, user }) => {
      if (user) token.id = user.id
      return token
    },
    session: ({ session, token }) => ({
      ...session,
      user: { ...session.user, id: token.id as string },
    }),
  },
  pages: {
    signIn: '/wayfarer-ai',
    error: '/wayfarer-ai/auth/error',
  },
}
