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
    const bridge = process.env.BRIDGE_URL || process.env.STUDIO_URL || 'http://localhost:3200';
    return [
      { source: '/studio', destination: `${studio}/studio` },
      { source: '/studio/:path*', destination: `${studio}/studio/:path*` },
      // the Claude Code bridge, on the same origin so the sign-in cookie carries over (on the server it sits behind
      // the same Caddy as the studio; locally it is `pnpm dev:bridge` on 3200)
      { source: '/mcp', destination: `${bridge}/mcp` },
      { source: '/connect', destination: `${bridge}/connect` },
      { source: '/api/brain/:path*', destination: `${bridge}/api/brain/:path*` },
    ];
  },
};

export default config;
