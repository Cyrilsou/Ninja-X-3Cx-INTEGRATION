/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  swcMinify: true,
  // Disable SSR for TV dashboard as it's a client-side app
  experimental: {
    appDir: true,
  },
  async rewrites() {
    return [
      {
        source: '/ws',
        destination: process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'ws://localhost:3003/tv',
      },
    ];
  },
}

module.exports = nextConfig