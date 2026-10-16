import type { NextConfig } from "next";

const isProduction = process.env.NODE_ENV === "production";
const scriptSources = [
  "'self'",
  "'unsafe-inline'",
  ...(isProduction ? [] : ["'unsafe-eval'"]),
  "blob:",
  "https://maps.googleapis.com",
  "https://maps.gstatic.com",
  "https://js.stripe.com",
  "https://translate.google.com",
  "https://translate.googleapis.com",
  "https://www.gstatic.com"
];

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "img-src 'self' data: blob: https://images.unsplash.com https://maps.gstatic.com https://maps.googleapis.com https://www.gstatic.com https://translate.google.com https://translate.googleapis.com",
      `script-src ${scriptSources.join(" ")}`,
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://translate.googleapis.com",
      "font-src 'self' data: https://fonts.gstatic.com",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://checkout.stripe.com https://api.resend.com https://api.openai.com https://maps.googleapis.com https://places.googleapis.com https://api.postcodes.io https://translate.google.com https://translate.googleapis.com https://translate-pa.googleapis.com",
      "frame-src https://js.stripe.com https://checkout.stripe.com https://translate.google.com",
      "worker-src 'self' blob:",
      "media-src 'self' blob:",
      "form-action 'self'",
      "upgrade-insecure-requests"
    ].join("; ")
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self), payment=(self)" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "X-Download-Options", value: "noopen" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" }
];

const searchPreviewNoIndexHeaders = [
  { key: "X-Robots-Tag", value: "noindex, noimageindex, noarchive" }
];

const searchPreviewNoIndexRoutes = [
  "/lda-canonical-logo.png",
  "/lda-search-preview.png"
];

const nextConfig: NextConfig = {
  compress: true,
  poweredByHeader: false,
  reactStrictMode: true,
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.ldrivingacademy.co.uk" }],
        destination: "https://ldrivingacademy.co.uk/:path*",
        permanent: true
      }
    ];
  },
  async headers() {
    return [
      {
        source: "/lda-email-logo-v1.jpg",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
          { key: "Cross-Origin-Resource-Policy", value: "cross-origin" },
          { key: "Access-Control-Allow-Origin", value: "*" }
        ]
      },
      {
        source: "/lda-web-logo.png",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
          { key: "Cross-Origin-Resource-Policy", value: "cross-origin" },
          { key: "Access-Control-Allow-Origin", value: "*" }
        ]
      },
      ...searchPreviewNoIndexRoutes.map((source) => ({
        source,
        headers: searchPreviewNoIndexHeaders
      })),
      {
        source: "/:path*",
        headers: securityHeaders
      }
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com"
      }
    ]
  }
};

export default nextConfig;
