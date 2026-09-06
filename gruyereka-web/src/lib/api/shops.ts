import "server-only";
import { apiRequest } from "@/lib/api/client";
import { type Page, pageSchema, type Shop, shopSchema } from "@/lib/api/schemas";

export const SHOPS_TAG = "shops";

export function listShops(input: {
  search?: string | undefined;
  city?: string | undefined;
  page?: number | undefined;
  perPage?: number | undefined;
}): Promise<Page<Shop>> {
  return apiRequest({
    path: "/shops",
    query: { search: input.search, city: input.city, page: input.page, perPage: input.perPage },
    schema: pageSchema(shopSchema),
    tags: [SHOPS_TAG],
  });
}

export function getShop(shopId: string): Promise<Shop> {
  return apiRequest({
    path: `/shops/${shopId}`,
    schema: shopSchema,
    tags: [SHOPS_TAG, `shop:${shopId}`],
  });
}
