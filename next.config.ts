import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  basePath: '/wayfarer-ai',
  async redirects() {
    if (process.env.NODE_ENV === 'development') {
      return [
        {
          source: '/',
          destination: '/wayfarer-ai',
          permanent: false,
          basePath: false,
        },
      ]
    }
    return []
  },
  images: {
    domains: ['lh3.googleusercontent.com', 'maps.googleapis.com'],
  },
}

export default nextConfig
