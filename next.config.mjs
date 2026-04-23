/** @type {import('next').NextConfig} */
const nextConfig = {
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
    domains: ['lh3.googleusercontent.com', 'maps.googleapis.com', 'images.unsplash.com', 'source.unsplash.com'],
  },
}

export default nextConfig
