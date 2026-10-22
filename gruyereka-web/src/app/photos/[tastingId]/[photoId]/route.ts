import { NextResponse } from "next/server";
import { z } from "zod";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

const ids = z.object({ tastingId: z.uuid(), photoId: z.uuid() });

/**
 * Tasting photos are public on the API, but the browser only ever talks to this
 * origin. This relays the 307 the API answers with, so the picture is fetched
 * straight from the bucket over a short-lived URL and no photo bytes pass
 * through either server.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ tastingId: string; photoId: string }> },
): Promise<Response> {
  // The segments are spliced into an API path; a `..` in one would walk the
  // relay onto another endpoint.
  const parsed = ids.safeParse(await context.params);
  if (!parsed.success) return new NextResponse(null, { status: 404 });
  const { tastingId, photoId } = parsed.data;
  const target = new URL(`/api/v1/tastings/${tastingId}/photos/${photoId}`, env().API_BASE_URL);

  let upstream: Response;
  try {
    upstream = await fetch(target, { redirect: "manual", cache: "no-store" });
  } catch {
    logger.error("photo.unreachable", { tastingId, photoId });
    return new NextResponse(null, { status: 502 });
  }

  const location = upstream.headers.get("location");
  if (upstream.status !== 307 || location === null) {
    return new NextResponse(null, { status: upstream.status === 404 ? 404 : 502 });
  }
  return NextResponse.redirect(location, 307);
}
