import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  // The Rust API is the only backend; nothing here needs to bundle server-only
  // Node APIs into the client.
  poweredByHeader: false,
  typedRoutes: true,
  experimental: {
    // A cheese photo travels through a server action, so the action limit has
    // to match the ceiling the API enforces on the upload route.
    serverActions: { bodySizeLimit: "10mb" },
  },
};

export default config;
