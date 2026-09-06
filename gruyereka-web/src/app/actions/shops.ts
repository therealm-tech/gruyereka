"use server";

import { revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { type FormState, fieldSentences } from "@/app/actions/state";
import { ApiError, ApiUnreachableError, sentenceFor } from "@/lib/api/errors";
import { GeocoderError, type Place, placeInputSchema, searchPlaces } from "@/lib/api/nominatim";
import {
  createShop,
  deleteMyShopReview,
  SHOP_REVIEWS_TAG,
  SHOPS_TAG,
  upsertMyShopReview,
} from "@/lib/api/shops";
import { logger } from "@/lib/logger";
import { currentUser, sessionToken } from "@/lib/session";
import { SHOP_KINDS } from "@/lib/vocabulary";

const LABELS: Record<string, string> = {
  name: "Le nom",
  kind: "Le type de boutique",
  osm: "La référence OpenStreetMap",
  street: "La rue",
  postalCode: "Le code postal",
  city: "La ville",
  countryCode: "Le pays",
  score: "La note",
  comment: "Le commentaire",
};

export type PlaceSearch = { status: "ok"; places: Place[] } | { status: "error"; message: string };

/**
 * Called straight from the search box rather than through a route handler, so
 * this app never exposes a geocoder proxy of its own. It is gated on a session
 * for the same reason: an open one would be somebody else's free Nominatim, and
 * the usage policy would land on us.
 */
export async function findPlaces(query: string): Promise<PlaceSearch> {
  if ((await currentUser()) === null) {
    return { status: "error", message: "Connectez-vous pour chercher une boutique." };
  }
  try {
    return { status: "ok", places: await searchPlaces(query) };
  } catch (error) {
    if (error instanceof GeocoderError) {
      return {
        status: "error",
        message: "OpenStreetMap n’a pas répondu. Réessayez dans un instant.",
      };
    }
    throw error;
  }
}

function refusal(error: unknown): FormState {
  if (error instanceof ApiError) {
    const fields = fieldSentences(error.fields, LABELS);
    return fields === undefined
      ? { status: "error", message: sentenceFor(error) }
      : { status: "error", message: sentenceFor(error), fields };
  }
  if (error instanceof ApiUnreachableError) return { status: "error", message: sentenceFor(error) };
  throw error;
}

const newShop = z.object({
  kind: z.enum(SHOP_KINDS, { message: "Choisissez un type de boutique." }),
  place: z.string().transform((raw, context): Place => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      context.addIssue({ code: "custom", message: "Choisissez un lieu dans la liste." });
      return z.NEVER;
    }
    const place = placeInputSchema.safeParse(parsed);
    if (!place.success) {
      context.addIssue({ code: "custom", message: "Ce lieu n’est pas exploitable." });
      return z.NEVER;
    }
    return { ...place.data, key: "", address: "" };
  }),
});

export async function addShop(_previous: FormState, formData: FormData): Promise<FormState> {
  const token = await sessionToken();
  if (token === null) {
    return { status: "error", message: "Connectez-vous pour ajouter une boutique." };
  }

  const parsed = newShop.safeParse({
    kind: formData.get("kind"),
    place: formData.get("place") ?? "",
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { status: "error", message: issue?.message ?? "Le formulaire n’a pas été accepté." };
  }

  const { kind, place } = parsed.data;
  let shopId: string;
  try {
    const created = await createShop(
      {
        name: place.name,
        kind,
        osm: place.osm,
        street: place.street,
        postalCode: place.postalCode,
        city: place.city,
        countryCode: place.countryCode,
        latitude: place.latitude,
        longitude: place.longitude,
      },
      token,
    );
    shopId = created.id;
    logger.info("shop.created", { shopId, osm: `${place.osm.element}:${place.osm.id}` });
  } catch (error) {
    if (error instanceof ApiError && error.code === "CONFLICT") {
      // Two people adding the same cheesemonger is the ordinary case, and the
      // whole point of keying a shop on OpenStreetMap; it is not a mistake to
      // report, so the second one simply lands on the fiche that exists.
      return {
        status: "error",
        message: "Cette boutique est déjà enregistrée. Cherchez-la dans la liste.",
      };
    }
    return refusal(error);
  }

  revalidateTag(SHOPS_TAG);
  redirect(`/boutiques/${shopId}`);
}

const review = z.object({
  shopId: z.uuid(),
  score: z
    .number()
    .int()
    .min(1, "Mettez une note de 1 à 5.")
    .max(5, "La note s’arrête à cinq trous."),
  comment: z
    .string()
    .trim()
    .max(2000, "Le commentaire ne peut pas dépasser 2000 caractères.")
    .transform((value) => (value.length === 0 ? null : value)),
});

export async function reviewShop(_previous: FormState, formData: FormData): Promise<FormState> {
  const token = await sessionToken();
  if (token === null) {
    return { status: "error", message: "Connectez-vous pour noter une boutique." };
  }

  const rawScore = formData.get("score");
  const parsed = review.safeParse({
    shopId: formData.get("shopId"),
    score: typeof rawScore === "string" ? Number.parseInt(rawScore, 10) : Number.NaN,
    comment: formData.get("comment") ?? "",
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { status: "error", message: issue?.message ?? "Le formulaire n’a pas été accepté." };
  }

  const { shopId, score, comment } = parsed.data;
  try {
    await upsertMyShopReview(shopId, { score, comment }, token);
    logger.info("shopReview.written", { shopId, score });
  } catch (error) {
    return refusal(error);
  }

  revalidateTag(SHOP_REVIEWS_TAG);
  revalidateTag(SHOPS_TAG);
  redirect(`/boutiques/${shopId}`);
}

export async function removeMyReview(formData: FormData): Promise<void> {
  const token = await sessionToken();
  const shopId = formData.get("shopId");
  if (token === null || typeof shopId !== "string") return;

  try {
    await deleteMyShopReview(shopId, token);
    logger.info("shopReview.removed", { shopId });
  } catch (error) {
    // Nothing to show: the button only exists next to a review that was read
    // from the same page, so a failure here means it went in another tab.
    logger.warn("shopReview.removeFailed", { shopId, reason: String(error) });
  }

  revalidateTag(SHOP_REVIEWS_TAG);
  revalidateTag(SHOPS_TAG);
  redirect(`/boutiques/${shopId}`);
}
