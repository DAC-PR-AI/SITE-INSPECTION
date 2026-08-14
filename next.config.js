/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

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
          // Limit browser permissions
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          // Content Security Policy — allow same-origin assets + Google Fonts
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Next.js requires unsafe-eval in dev
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob:",  // data: needed for signature canvas
              "connect-src 'self'",
              "frame-ancestors 'none'",
            ].join("; "),
          },
          // Remove server fingerprint
          { key: "X-Powered-By", value: "" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
