import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.PUBLIC_BASE_URL ?? "http://localhost:3000";
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Nothing to index behind the sign-in, and the relay only ever redirects.
      disallow: ["/connexion", "/photos/"],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
