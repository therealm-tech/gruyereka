import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { me } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/errors";
import type { User } from "@/lib/api/schemas";
import { logger } from "@/lib/logger";

/**
 * The access token lives in an httpOnly cookie this app sets, never in a value
 * the page's own JavaScript can read: an XSS then cannot walk off with it. The
 * browser only ever talks to this server, which forwards the bearer to
 * gruyereka-api, so the API needs no CORS grant for the web client.
 */
const COOKIE = "gruyereka_session";

export async function sessionToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(COOKIE)?.value ?? null;
}

/** Deduplicated per render pass: several components may ask who is signed in. */
export const currentUser = cache(async (): Promise<User | null> => {
  const token = await sessionToken();
  if (token === null) return null;
  try {
    return await me(token);
  } catch (error) {
    // A token outliving its account, or its expiry, is an ordinary signed-out
    // state rather than a failure worth showing anybody.
    if (error instanceof ApiError && error.code === "UNAUTHENTICATED") return null;
    logger.warn("session.resolveFailed", { reason: String(error) });
    return null;
  }
});

export async function startSession(token: string, expiresInSeconds: number): Promise<void> {
  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: expiresInSeconds,
  });
}

export async function endSession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE);
}
