import "server-only";
import { apiRequest } from "@/lib/api/client";
import { type Page, pageSchema, type User, userSchema } from "@/lib/api/schemas";
import type { UserRole } from "@/lib/vocabulary";

/**
 * Both operations are administrators-only, and both answer `403` to anybody
 * else — the API reserves `403` for the endpoints where there is nothing to
 * hide, rather than the `404` it gives on somebody else's row.
 *
 * Neither read is cached: the listing carries e-mail addresses and is fetched
 * with a bearer, so it must not sit in a store keyed on a URL.
 */

export function listUsers(
  input: { page?: number | undefined; perPage?: number | undefined },
  token: string,
): Promise<Page<User>> {
  return apiRequest({
    path: "/users",
    query: { page: input.page, perPage: input.perPage },
    token,
    schema: pageSchema(userSchema),
    revalidate: false,
  });
}

export function setUserRole(userId: string, role: UserRole, token: string): Promise<User> {
  return apiRequest({
    path: `/users/${userId}/role`,
    method: "PUT",
    body: { role },
    token,
    schema: userSchema,
  });
}
