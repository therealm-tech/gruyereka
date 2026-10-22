import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  // The Rust API is the only backend; nothing here needs to bundle server-only
  // Node APIs into the client.
  poweredByHeader: false,
  typedRoutes: true,
  experimental: {
    // A new tasting carries its photos through one server action: up to ten of
    // the 10 MiB the API accepts each, plus room for the basket's fields and
    // the multipart framing.
    serverActions: { bodySizeLimit: "105mb" },
  },
};

export default config;
