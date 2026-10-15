import type { NextConfig } from 'next';

const config: NextConfig = {
  // workspace packages ship TypeScript source
  transpilePackages: ['@moovi/brand', '@moovi/character', '@moovi/ui'],
  reactStrictMode: true,
  // a second dev server (e.g. a preview alongside another session's) needs its own build folder and lock
  distDir: process.env.NEXT_DIST_DIR || '.next',
  // the studio is its own app (a zone) under this origin, so the brief, its files and the sign-in cookie carry over
  async rewrites() {
    const studio = process.env.STUDIO_URL || 'http://localhost:3100';
    return [
      { source: '/studio', destination: `${studio}/studio` },
      { source: '/studio/:path*', destination: `${studio}/studio/:path*` },
    ];
  },
};

export default config;
