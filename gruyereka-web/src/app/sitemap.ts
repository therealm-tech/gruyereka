import type { MetadataRoute } from "next";
import { listCheeses } from "@/lib/api/cheeses";
import type { Page } from "@/lib/api/schemas";
import { listShops } from "@/lib/api/shops";
import { logger } from "@/lib/logger";

/** The catalogue moves, so the map is rebuilt hourly rather than at build time. */
export const revalidate = 3600;

const PER_PAGE = 100;
const MAX_PAGES = 50;

type Listed = { id: string; updatedAt: string };

/** Walks a paginated listing to its end, or to the ceiling, whichever is first. */
async function walk<T extends Listed>(
  list: (page: number) => Promise<Page<T>>,
  base: string,
  segment: string,
  into: MetadataRoute.Sitemap,
): Promise<void> {
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const result = await list(page);
    for (const item of result.items) {
      into.push({
        url: `${base}/${segment}/${item.id}`,
        lastModified: new Date(item.updatedAt),
        changeFrequency: "weekly",
      });
    }
    if (result.page * result.perPage >= result.total) break;
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.PUBLIC_BASE_URL ?? "http://localhost:3000";
  const entries: MetadataRoute.Sitemap = [
    { url: `${base}/fromages`, changeFrequency: "daily", priority: 0.8 },
    { url: `${base}/boutiques`, changeFrequency: "daily", priority: 0.8 },
  ];

  try {
    await walk(
      (page) => listCheeses({ page, perPage: PER_PAGE, revalidate }),
      base,
      "fromages",
      entries,
    );
    await walk(
      (page) => listShops({ page, perPage: PER_PAGE, revalidate }),
      base,
      "boutiques",
      entries,
    );
  } catch (error) {
    // A map missing some fiches beats a 500 where a crawler expected XML.
    logger.warn("sitemap.partial", { reason: String(error) });
  }

  return entries;
}
