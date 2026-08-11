import type { NextConfig } from 'next';

const apiPort = process.env.API_PORT ?? '3002';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Next's built-in gzip compression buffers proxied streaming responses —
  // /api/events (SSE) trickles data one small event at a time, so the
  // compressor never flushes and the browser's EventSource sees nothing
  // until the connection closes. Caddy (or whatever fronts this in
  // production) should handle compression instead.
  compress: false,
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `http://127.0.0.1:${apiPort}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
