import "server-only";
import { apiRequest } from "@/lib/api/client";
import { type Page, pageSchema, type Tasting, tastingSchema } from "@/lib/api/schemas";

export const TASTINGS_TAG = "tastings";

export function listTastings(input: {
  cheeseId?: string | undefined;
  shopId?: string | undefined;
  userId?: string | undefined;
  page?: number | undefined;
  perPage?: number | undefined;
}): Promise<Page<Tasting>> {
  return apiRequest({
    path: "/tastings",
    query: {
      cheeseId: input.cheeseId,
      shopId: input.shopId,
      userId: input.userId,
      page: input.page,
      perPage: input.perPage,
    },
    schema: pageSchema(tastingSchema),
    tags: [TASTINGS_TAG],
  });
}
