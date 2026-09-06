import "server-only";
import { apiRequest } from "@/lib/api/client";
import { type Cheese, cheeseSchema, type Page, pageSchema } from "@/lib/api/schemas";
import type { MilkType, PasteType, ProtectedDesignation } from "@/lib/vocabulary";

export const CHEESES_TAG = "cheeses";

export function listCheeses(input: {
  search?: string | undefined;
  page?: number | undefined;
  perPage?: number | undefined;
  revalidate?: number | false | undefined;
}): Promise<Page<Cheese>> {
  return apiRequest({
    path: "/cheeses",
    query: { search: input.search, page: input.page, perPage: input.perPage },
    schema: pageSchema(cheeseSchema),
    tags: [CHEESES_TAG],
    ...(input.revalidate === undefined ? {} : { revalidate: input.revalidate }),
  });
}

export function getCheese(cheeseId: string): Promise<Cheese> {
  return apiRequest({
    path: `/cheeses/${cheeseId}`,
    schema: cheeseSchema,
    tags: [CHEESES_TAG, `cheese:${cheeseId}`],
  });
}

export type NewCheese = {
  name: string;
  milkTypes: MilkType[];
  pasteType: PasteType;
  designation: ProtectedDesignation | null;
  agingMonths: number | null;
};

/** The photo is a second call: the API keys it on a cheese that already exists. */
export function uploadCheesePhoto(cheeseId: string, photo: File, token: string): Promise<Cheese> {
  const body = new FormData();
  body.append("photo", photo, photo.name);
  return apiRequest({
    path: `/cheeses/${cheeseId}/photo`,
    method: "PUT",
    formData: body,
    token,
    schema: cheeseSchema,
  });
}

export function createCheese(input: NewCheese, token: string): Promise<Cheese> {
  return apiRequest({
    path: "/cheeses",
    method: "POST",
    body: input,
    token,
    schema: cheeseSchema,
  });
}
