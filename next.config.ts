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
              "img-src 'self' data: blob: http://localhost:8000 https://*.supabase.co",
              "font-src 'self' data:",
              "connect-src 'self' http://localhost:8000 https://challenges.cloudflare.com https://*.supabase.co",
              "frame-src 'self' https://challenges.cloudflare.com",
              "frame-ancestors 'self' https://the-site-embedding-this.com",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;