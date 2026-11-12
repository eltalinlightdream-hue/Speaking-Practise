import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// Cache Components is turned off on purpose: almost every page in this app
// depends on the signed-in user, so the simpler request-time rendering model
// is easier to work with. It can be enabled later if needed.
const nextConfig: NextConfig = {
  experimental: {
    // Admin JSON imports can be larger than the 1 MB default.
    serverActions: { bodySizeLimit: "6mb" },
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
