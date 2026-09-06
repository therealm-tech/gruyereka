import "server-only";
import { apiRequest, apiRequestNoContent } from "@/lib/api/client";
import {
  type Page,
  pageSchema,
  type Shop,
  type ShopReview,
  shopReviewSchema,
  shopSchema,
} from "@/lib/api/schemas";
import type { OsmElement, ShopKind } from "@/lib/vocabulary";

export const SHOPS_TAG = "shops";
export const SHOP_REVIEWS_TAG = "shopReviews";

export function listShops(input: {
  search?: string | undefined;
  city?: string | undefined;
  page?: number | undefined;
  perPage?: number | undefined;
  revalidate?: number | false | undefined;
}): Promise<Page<Shop>> {
  return apiRequest({
    path: "/shops",
    query: { search: input.search, city: input.city, page: input.page, perPage: input.perPage },
    schema: pageSchema(shopSchema),
    tags: [SHOPS_TAG],
    ...(input.revalidate === undefined ? {} : { revalidate: input.revalidate }),
  });
}

export function getShop(shopId: string): Promise<Shop> {
  return apiRequest({
    path: `/shops/${shopId}`,
    schema: shopSchema,
    tags: [SHOPS_TAG, `shop:${shopId}`],
  });
}

export type NewShop = {
  name: string;
  kind: ShopKind;
  osm: { element: OsmElement; id: number };
  street: string | null;
  postalCode: string | null;
  city: string;
  countryCode: string;
  latitude: number;
  longitude: number;
};

export function createShop(input: NewShop, token: string): Promise<Shop> {
  return apiRequest({ path: "/shops", method: "POST", body: input, token, schema: shopSchema });
}

export function listShopReviews(input: {
  shopId: string;
  page?: number | undefined;
  perPage?: number | undefined;
}): Promise<Page<ShopReview>> {
  return apiRequest({
    path: `/shops/${input.shopId}/reviews`,
    query: { page: input.page, perPage: input.perPage },
    schema: pageSchema(shopReviewSchema),
    tags: [SHOP_REVIEWS_TAG, `shop:${input.shopId}`],
  });
}

/**
 * One review per author and per shop, so this is a `PUT` on `me` rather than a
 * `POST`: sending it again rewrites the one that is there.
 */
export function upsertMyShopReview(
  shopId: string,
  input: { score: number; comment: string | null },
  token: string,
): Promise<ShopReview> {
  return apiRequest({
    path: `/shops/${shopId}/reviews/me`,
    method: "PUT",
    body: input,
    token,
    schema: shopReviewSchema,
  });
}

export function deleteMyShopReview(shopId: string, token: string): Promise<void> {
  return apiRequestNoContent({
    path: `/shops/${shopId}/reviews/me`,
    method: "DELETE",
    token,
  });
}
