import type { MetadataRoute } from "next";
import { listCheeses } from "@/lib/api/cheeses";
import { logger } from "@/lib/logger";

/** The catalogue moves, so the map is rebuilt hourly rather than at build time. */
export const revalidate = 3600;

const PER_PAGE = 100;
const MAX_PAGES = 50;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.PUBLIC_BASE_URL ?? "http://localhost:3000";
  const entries: MetadataRoute.Sitemap = [
    { url: `${base}/fromages`, changeFrequency: "daily", priority: 0.8 },
  ];

  try {
    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const result = await listCheeses({ page, perPage: PER_PAGE, revalidate });
      for (const cheese of result.items) {
        entries.push({
          url: `${base}/fromages/${cheese.id}`,
          lastModified: new Date(cheese.updatedAt),
          changeFrequency: "weekly",
        });
      }
      if (result.page * result.perPage >= result.total) break;
    }
  } catch (error) {
    // A map missing its cheeses beats a 500 where a crawler expected XML.
    logger.warn("sitemap.partial", { reason: String(error) });
  }

  return entries;
}
