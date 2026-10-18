/** @type {import('next').NextConfig} */
const BACKEND = (process.env.BACKEND_URL || 'http://127.0.0.1:8000').replace(/\/$/, '')

const nextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // The browser only ever talks to this site. /api/* is forwarded to the Python server,
  // so the login cookie stays first-party and no CORS setup is needed.
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${BACKEND}/:path*` }]
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), geolocation=(), microphone=(self)' },
        ],
      },
    ]
  },
}

export default nextConfig
