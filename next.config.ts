import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [""],
  poweredByHeader: false, // removes the "X-Powered-By" header
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
        port: "8000",
        pathname: "/storage/v1/object/public/**",
      },
      {
        // Profile pictures are served from Supabase Storage in production.
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: http://localhost:8000 https://*.supabase.co https://*.walletconnect.com https://*.walletconnect.org https://*.reown.com https://*.web3modal.org https://imagedelivery.net",
              "font-src 'self' data: https://fonts.reown.com",
              "connect-src 'self' http://localhost:8000 https://challenges.cloudflare.com https://*.supabase.co https://rpc.walletconnect.org https://pulse.walletconnect.org https://api.web3modal.org https://explorer-api.walletconnect.com wss://relay.walletconnect.org",
              "frame-src 'self' https://challenges.cloudflare.com https://secure.walletconnect.com https://secure.walletconnect.org https://*.reown.com",
              "frame-ancestors 'self' https://the-site-embedding-this.com",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
