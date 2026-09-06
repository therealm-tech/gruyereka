import "server-only";
import { z } from "zod";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import type { OsmElement } from "@/lib/vocabulary";

/**
 * The geocoder side of shop creation: a shop is its OpenStreetMap reference, so
 * the client resolves one here before posting anything to gruyereka-api, which
 * never contacts OpenStreetMap itself. See ADR 0002.
 */

export class GeocoderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GeocoderError";
  }
}

const ELEMENTS: Record<string, OsmElement> = {
  node: "NODE",
  way: "WAY",
  relation: "RELATION",
};

const placeSchema = z.object({
  osm_type: z.string(),
  osm_id: z.number().int(),
  lat: z.string(),
  lon: z.string(),
  name: z.string().optional(),
  display_name: z.string(),
  address: z
    .object({
      house_number: z.string().optional(),
      road: z.string().optional(),
      postcode: z.string().optional(),
      city: z.string().optional(),
      town: z.string().optional(),
      village: z.string().optional(),
      municipality: z.string().optional(),
      country_code: z.string().optional(),
    })
    .optional(),
});

/** A candidate, already shaped like the shop it would become. */
export type Place = {
  /** Stable within one result set; the form posts the whole place back. */
  key: string;
  name: string;
  street: string | null;
  postalCode: string | null;
  city: string;
  countryCode: string;
  latitude: number;
  longitude: number;
  osm: { element: OsmElement; id: number };
  /** Nominatim's own one-line rendering, to disambiguate two similar hits. */
  address: string;
};

export const placeInputSchema = z.object({
  name: z.string().trim().min(1).max(160),
  street: z.string().trim().min(1).max(200).nullable(),
  postalCode: z.string().trim().min(1).max(20).nullable(),
  city: z.string().trim().min(1).max(120),
  countryCode: z.string().length(2),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  osm: z.object({ element: z.enum(["NODE", "WAY", "RELATION"]), id: z.number().int() }),
});

function street(address: z.infer<typeof placeSchema>["address"]): string | null {
  if (address?.road === undefined) return null;
  return address.house_number === undefined
    ? address.road
    : `${address.house_number} ${address.road}`;
}

function city(address: z.infer<typeof placeSchema>["address"]): string | null {
  return address?.city ?? address?.town ?? address?.village ?? address?.municipality ?? null;
}

function toPlace(raw: z.infer<typeof placeSchema>): Place | null {
  const element = ELEMENTS[raw.osm_type.toLowerCase()];
  const town = city(raw.address);
  const country = raw.address?.country_code;
  const latitude = Number.parseFloat(raw.lat);
  const longitude = Number.parseFloat(raw.lon);
  // A hit without a name, a town or a country cannot become a shop, and there
  // is nothing sensible to invent for it — it is dropped rather than shown.
  if (
    element === undefined ||
    raw.name === undefined ||
    raw.name.trim().length === 0 ||
    town === null ||
    country === undefined ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    return null;
  }
  return {
    key: `${element}:${raw.osm_id}`,
    name: raw.name,
    street: street(raw.address),
    postalCode: raw.address?.postcode ?? null,
    city: town,
    countryCode: country.toUpperCase(),
    latitude,
    longitude,
    osm: { element, id: raw.osm_id },
    address: raw.display_name,
  };
}

/**
 * Nominatim's usage policy allows one request per second from an application,
 * and answers a burst with 429 then a block. The queue below is what keeps a
 * person typing in the search box from turning into a burst; it is per process,
 * which is enough while this app runs as one instance and would need moving to
 * a shared store the day it does not.
 */
const MIN_INTERVAL_MS = 1000;
let lastCallAt = 0;
let gate: Promise<void> = Promise.resolve();

function nextSlot(): Promise<void> {
  const slot = gate.then(async () => {
    const wait = lastCallAt + MIN_INTERVAL_MS - Date.now();
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    lastCallAt = Date.now();
  });
  // A failed search must not wedge the queue for every later one.
  gate = slot.catch(() => undefined);
  return slot;
}

const LIMIT = 8;

export async function searchPlaces(query: string): Promise<Place[]> {
  const trimmed = query.trim();
  if (trimmed.length < 3) return [];

  const target = new URL("/search", env().NOMINATIM_BASE_URL);
  target.searchParams.set("q", trimmed);
  target.searchParams.set("format", "jsonv2");
  target.searchParams.set("addressdetails", "1");
  target.searchParams.set("limit", String(LIMIT));

  await nextSlot();

  let response: Response;
  try {
    response = await fetch(target, {
      headers: {
        accept: "application/json",
        "user-agent": env().NOMINATIM_USER_AGENT,
      },
      // A place's identity does not move, so the same query is worth a day.
      next: { revalidate: 86_400 },
    });
  } catch (cause) {
    logger.error("nominatim.unreachable", { reason: String(cause) });
    throw new GeocoderError("the geocoder could not be reached");
  }

  if (!response.ok) {
    logger.error("nominatim.refused", { status: response.status });
    throw new GeocoderError(`the geocoder answered ${response.status}`);
  }

  const parsed = z.array(placeSchema).safeParse(await response.json());
  if (!parsed.success) {
    logger.error("nominatim.offContract", { issues: parsed.error.issues.length });
    throw new GeocoderError("the geocoder answered a body this client cannot read");
  }

  const places = parsed.data.map(toPlace).filter((place): place is Place => place !== null);
  logger.debug("nominatim.searched", { hits: parsed.data.length, usable: places.length });
  return places;
}
