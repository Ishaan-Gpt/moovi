import type { NextConfig } from 'next';

const config: NextConfig = {
  // the studio is a zone under the landing page's origin: /studio/*
  basePath: '/studio',
  // workspace packages ship TypeScript source
  transpilePackages: ['@moovi/brand', '@moovi/character', '@moovi/engine', '@moovi/graph', '@moovi/mcp', '@moovi/skills', '@moovi/ui'],
  // Node-side clients stay out of the bundle (sockets, child processes, the browser driver)
  serverExternalPackages: ['falkordb', 'redis', '@redis/client', '@anthropic-ai/claude-agent-sdk', 'playwright-core', '@huggingface/transformers', 'onnxruntime-node', '@modelcontextprotocol/sdk'],
  reactStrictMode: true,
  experimental: { serverActions: { bodySizeLimit: '2mb' } },
};

export default config;
