/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV !== "production";

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  // HTTP Security Headers applied to every response
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Prevent clickjacking
          { key: "X-Frame-Options", value: "DENY" },
          // Stop MIME-type sniffing
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Force HTTPS for 2 years
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          // Control referrer information
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Limit browser permissions (camera enabled for on-site photo evidence)
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
          // Content Security Policy — hardened for production
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "object-src 'none'",
              "base-uri 'self'",
              `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com data:",
              "img-src 'self' data: blob: https://drive.google.com https://*.googleusercontent.com",
              "connect-src 'self' https://*.vercel.app",
              "frame-ancestors 'none'",
              ...(isDev ? [] : ["upgrade-insecure-requests"]),
            ].join("; "),
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;

