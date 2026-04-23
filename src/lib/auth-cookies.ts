export const isSecureAuthCookie = process.env.NODE_ENV === 'production'

export const sessionCookieName = isSecureAuthCookie
  ? '__Secure-wayfarer.session-token'
  : 'wayfarer.session-token'

export const callbackCookieName = isSecureAuthCookie
  ? '__Secure-wayfarer.callback-url'
  : 'wayfarer.callback-url'

export const csrfCookieName = isSecureAuthCookie
  ? '__Host-wayfarer.csrf-token'
  : 'wayfarer.csrf-token'

export const pkceCookieName = isSecureAuthCookie
  ? '__Secure-wayfarer.pkce.code_verifier'
  : 'wayfarer.pkce.code_verifier'

export const stateCookieName = isSecureAuthCookie
  ? '__Secure-wayfarer.state'
  : 'wayfarer.state'
