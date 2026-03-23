/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: process.env.NEXT_PUBLIC_API_URL 
          ? `${process.env.NEXT_PUBLIC_API_URL}/api/:path*`
          : 'http://localhost:3001/api/:path*',
      },
      {
        source: '/agents/skills/:slug/SKILL.md',
        destination: '/api/agents/skills/:slug/SKILL.md',
      },
    ];
  },
};

module.exports = nextConfig;
