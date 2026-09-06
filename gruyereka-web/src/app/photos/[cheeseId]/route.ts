import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

/**
 * Cheese photos are public on the API, but the browser only ever talks to this
 * origin. This relays the 307 the API answers with, so the picture is fetched
 * straight from the bucket over a short-lived URL and no photo bytes pass
 * through either server.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ cheeseId: string }> },
): Promise<Response> {
  const { cheeseId } = await context.params;
  const target = new URL(`/api/v1/cheeses/${cheeseId}/photo`, env().API_BASE_URL);

  let upstream: Response;
  try {
    upstream = await fetch(target, { redirect: "manual", cache: "no-store" });
  } catch {
    logger.error("photo.unreachable", { cheeseId });
    return new NextResponse(null, { status: 502 });
  }

  const location = upstream.headers.get("location");
  if (upstream.status !== 307 || location === null) {
    return new NextResponse(null, { status: upstream.status === 404 ? 404 : 502 });
  }
  return NextResponse.redirect(location, 307);
}
