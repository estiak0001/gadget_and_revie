import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['localhost', '127.0.0.1'],
  // Enable image optimization for external domains
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "**",
      },
      {
        protocol: "http",
        hostname: "localhost",
      },
    ],
    // Modern formats for smaller payloads on mobile
    formats: ["image/avif", "image/webp"],
    // Responsive device sizes for mobile-first
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
    // Reduce quality slightly for faster mobile loads
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days
    // next/image refuses to serve .svg sources at all unless explicitly opted in (an uploaded
    // category icon/logo silently fails to render otherwise) — the CSP here locks the served
    // SVG down to no scripts/sandboxed, since an SVG can otherwise carry embedded <script>.
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },

  // Enable gzip/brotli compression
  compress: true,

  // Performance headers
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Cache static assets aggressively
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
        ],
      },
      {
        // Cache static assets (images, fonts, etc.)
        source: "/(.*)\\.(jpg|jpeg|png|gif|ico|svg|woff|woff2|ttf|eot)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        // Cache Next.js static files
        source: "/_next/static/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },

  // Enable React strict mode for better dev experience
  reactStrictMode: true,

  // Optimize package imports to reduce bundle size
  experimental: {
    optimizePackageImports: [
      "@heroicons/react/24/outline",
      "@heroicons/react/24/solid",
      "date-fns",
      "react-hot-toast",
    ],
  },
};

export default nextConfig;
