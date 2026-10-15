import type { NextConfig } from 'next';

const config: NextConfig = {
  // the studio is a zone under the landing page's origin: /studio/*
  basePath: '/studio',
  // workspace packages ship TypeScript source
  transpilePackages: ['@contenteasy/brand', '@contenteasy/character', '@contenteasy/engine', '@contenteasy/graph', '@contenteasy/skills', '@contenteasy/ui'],
  // Node-side clients stay out of the bundle (sockets, child processes, the browser driver)
  serverExternalPackages: ['falkordb', 'redis', '@redis/client', '@anthropic-ai/claude-agent-sdk', 'playwright-core'],
  reactStrictMode: true,
  experimental: { serverActions: { bodySizeLimit: '2mb' } },
};

export default config;
