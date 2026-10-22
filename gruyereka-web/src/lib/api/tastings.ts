import "server-only";
import { apiRequest, apiRequestNoContent } from "@/lib/api/client";
import {
  type Page,
  type PricePerKg,
  pageSchema,
  type Tasting,
  type TastingPhoto,
  tastingPhotoSchema,
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

export type NewTastingItem = {
  cheeseId: string;
  rating: RatingLevel;
  pricePerKg: PricePerKg | null;
  comment: string | null;
};

export type NewTasting = {
  shopId: string;
  tastedOn: string;
  items: NewTastingItem[];
};

/**
 * The shop and the author are fixed at creation; the day and the whole list of
 * cheeses are rewritten in one go, so dropping a cheese from a visit is sending
 * the list without it.
 */
export type TastingEdit = Omit<NewTasting, "shopId">;

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

/** A photo hangs on a visit that already exists, one call per file. */
export function uploadTastingPhoto(
  tastingId: string,
  photo: File,
  token: string,
): Promise<TastingPhoto> {
  const body = new FormData();
  body.append("photo", photo, photo.name);
  return apiRequest({
    path: `/tastings/${tastingId}/photos`,
    method: "POST",
    formData: body,
    token,
    schema: tastingPhotoSchema,
  });
}

export function deleteTastingPhoto(
  tastingId: string,
  photoId: string,
  token: string,
): Promise<void> {
  return apiRequestNoContent({
    path: `/tastings/${tastingId}/photos/${photoId}`,
    method: "DELETE",
    token,
  });
}
