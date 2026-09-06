import "server-only";
import { apiRequest, apiRequestNoContent } from "@/lib/api/client";
import {
  type Page,
  type PricePerKg,
  pageSchema,
  type Tasting,
  tastingSchema,
} from "@/lib/api/schemas";
import type { RatingLevel } from "@/lib/vocabulary";

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

export function getTasting(tastingId: string): Promise<Tasting> {
  return apiRequest({
    path: `/tastings/${tastingId}`,
    schema: tastingSchema,
    tags: [TASTINGS_TAG, `tasting:${tastingId}`],
  });
}

export type NewTasting = {
  cheeseId: string;
  shopId: string;
  rating: RatingLevel;
  pricePerKg: PricePerKg | null;
  comment: string | null;
  tastedOn: string;
};

/** The cheese and the shop are fixed at creation: a correction cannot move one. */
export type TastingEdit = Omit<NewTasting, "cheeseId" | "shopId">;

export function createTasting(input: NewTasting, token: string): Promise<Tasting> {
  return apiRequest({
    path: "/tastings",
    method: "POST",
    body: input,
    token,
    schema: tastingSchema,
  });
}

export function updateTasting(
  tastingId: string,
  input: TastingEdit,
  token: string,
): Promise<Tasting> {
  return apiRequest({
    path: `/tastings/${tastingId}`,
    method: "PUT",
    body: input,
    token,
    schema: tastingSchema,
  });
}

export function deleteTasting(tastingId: string, token: string): Promise<void> {
  return apiRequestNoContent({ path: `/tastings/${tastingId}`, method: "DELETE", token });
}
