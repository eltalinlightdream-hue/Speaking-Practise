import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// Cache Components is turned off on purpose: almost every page in this app
// depends on the signed-in user, so the simpler request-time rendering model
// is easier to work with. It can be enabled later if needed.
const nextConfig: NextConfig = {
  experimental: {
    // Admin JSON imports can be larger than the 1 MB default.
    serverActions: { bodySizeLimit: "6mb" },
    // Without internet, page changes and form saves wait and retry by
    // themselves when the connection is back (instead of showing an error).
    useOffline: true,
    // Pages opened in the last 30 seconds show again instantly when the
    // student goes back to them (tab bar). Saves refresh them right away.
    staleTimes: { dynamic: 30 },
  },
  async headers() {
    return [
      {
        // The service worker must always be checked for a newer version.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
  // The weekly PDF report reads the Inter font files from disk.
  outputFileTracingIncludes: {
    "/progress/report": ["./src/assets/fonts/**/*"],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl(nextConfig);
