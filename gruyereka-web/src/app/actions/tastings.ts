"use server";

import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { type FormState, fieldSentences } from "@/app/actions/state";
import { CHEESES_TAG } from "@/lib/api/cheeses";
import { ApiError, ApiUnreachableError, sentenceFor } from "@/lib/api/errors";
import type { PricePerKg } from "@/lib/api/schemas";
import { SHOPS_TAG } from "@/lib/api/shops";
import {
  createTasting,
  deleteTasting,
  type NewTastingItem,
  TASTINGS_TAG,
  updateTasting,
} from "@/lib/api/tastings";
import { parseAmountCents, todayIso } from "@/lib/format";
import { logger } from "@/lib/logger";
import { sessionToken } from "@/lib/session";
import { CURRENCIES, RATING_LEVELS } from "@/lib/vocabulary";

const LABELS: Record<string, string> = {
  shopId: "La boutique",
  items: "Les fromages",
  tastedOn: "La date",
};

/** Matches the API's own ceiling; a basket past it is a data-entry accident. */
const MAX_ITEMS = 50;

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

const visit = z.object({
  tastedOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "La date n’est pas lisible.")
    .refine((value) => value >= "1900-01-01", "Cette date est trop ancienne.")
    // A log entry is something that happened; tomorrow has not.
    .refine((value) => value <= todayIso(), "On ne note pas une dégustation à venir."),
  // One currency for the whole visit: you do not pay in euros at the counter and
  // in francs two cheeses later.
  currency: z.enum(CURRENCIES),
});

const item = z.object({
  cheeseId: z.uuid(),
  rating: z.enum(RATING_LEVELS, { message: "Dites ce que vous avez pensé de chaque fromage." }),
  comment: z
    .string()
    .trim()
    .max(2000, "Un commentaire ne peut pas dépasser 2000 caractères.")
    .transform((value) => (value.length === 0 ? null : value)),
});

const PRICE_REFUSED = "Le prix au kilo s’écrit en euros, par exemple 32,50.";

type Basket = { status: "ok"; items: NewTastingItem[] } | { status: "error"; state: FormState };

/**
 * The rows arrive as `items.<n>.<field>`, indexed rather than repeated, because
 * a rating is a radio group and a shared name would make one group of the whole
 * basket. Holes are skipped, so removing a row needs no renumbering.
 */
function readBasket(formData: FormData, currency: string): Basket {
  const items: NewTastingItem[] = [];
  const fields: Record<string, string> = {};
  let message: string | null = null;

  for (let index = 0; index < MAX_ITEMS; index += 1) {
    const cheeseId = formData.get(`items.${index}.cheeseId`);
    if (typeof cheeseId !== "string" || cheeseId.length === 0) continue;

    const raw = formData.get(`items.${index}.pricePerKg`);
    const cents = parseAmountCents(typeof raw === "string" ? raw : "");
    if (cents === "unreadable") {
      fields[`items.${index}.pricePerKg`] = PRICE_REFUSED;
      message ??= PRICE_REFUSED;
      continue;
    }

    const parsed = item.safeParse({
      cheeseId,
      rating: formData.get(`items.${index}.rating`),
      comment: formData.get(`items.${index}.comment`) ?? "",
    });
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const sentence = issue?.message ?? "Cette ligne n’a pas été acceptée.";
      fields[`items.${index}.${issue?.path.join(".") ?? "cheeseId"}`] = sentence;
      message ??= sentence;
      continue;
    }

    const price: PricePerKg | null = cents === null ? null : { amountCents: cents, currency };
    items.push({ ...parsed.data, pricePerKg: price });
  }

  if (message !== null) return { status: "error", state: { status: "error", message, fields } };
  if (items.length === 0) {
    return {
      status: "error",
      state: { status: "error", message: "Ajoutez au moins un fromage à cette dégustation." },
    };
  }
  if (new Set(items.map((one) => one.cheeseId)).size !== items.length) {
    return {
      status: "error",
      state: {
        status: "error",
        message: "Le même fromage est listé deux fois. Une ligne suffit.",
      },
    };
  }
  return { status: "ok", items };
}

function firstIssue(error: z.ZodError): FormState {
  const issue = error.issues[0];
  return {
    status: "error",
    message: issue?.message ?? "Le formulaire n’a pas été accepté.",
    fields: Object.fromEntries(
      error.issues.map((one) => [one.path.join("."), one.message] as const),
    ),
  };
}

export async function addTasting(_previous: FormState, formData: FormData): Promise<FormState> {
  const token = await sessionToken();
  if (token === null) {
    return { status: "error", message: "Connectez-vous pour noter une dégustation." };
  }

  const parsed = visit.safeParse({
    tastedOn: formData.get("tastedOn"),
    currency: formData.get("currency") ?? "EUR",
  });
  if (!parsed.success) return firstIssue(parsed.error);

  const shopId = formData.get("shopId");
  if (typeof shopId !== "string" || shopId.length === 0) {
    return { status: "error", message: "Choisissez la boutique où vous les avez achetés." };
  }

  const basket = readBasket(formData, parsed.data.currency);
  if (basket.status === "error") return basket.state;

  try {
    const tasting = await createTasting(
      { shopId, tastedOn: parsed.data.tastedOn, items: basket.items },
      token,
    );
    logger.info("tasting.created", { tastingId: tasting.id, cheeses: basket.items.length });
  } catch (error) {
    if (error instanceof ApiError && error.code === "UNKNOWN_REFERENCE") {
      return {
        status: "error",
        message: "Un fromage ou la boutique a disparu pendant que vous écriviez.",
      };
    }
    return refusal(error);
  }

  // Every cheese in the basket has a new average and a new count, so its fiche
  // and every listing showing it are stale the moment this lands.
  updateTag(TASTINGS_TAG);
  updateTag(CHEESES_TAG);
  redirect("/carnet");
}

export async function editTasting(_previous: FormState, formData: FormData): Promise<FormState> {
  const token = await sessionToken();
  if (token === null) {
    return { status: "error", message: "Connectez-vous pour corriger une dégustation." };
  }

  const tastingId = formData.get("tastingId");
  if (typeof tastingId !== "string") {
    return { status: "error", message: "Cette dégustation n’a pas pu être retrouvée." };
  }

  const parsed = visit.safeParse({
    tastedOn: formData.get("tastedOn"),
    currency: formData.get("currency") ?? "EUR",
  });
  if (!parsed.success) return firstIssue(parsed.error);

  const basket = readBasket(formData, parsed.data.currency);
  if (basket.status === "error") return basket.state;

  try {
    await updateTasting(tastingId, { tastedOn: parsed.data.tastedOn, items: basket.items }, token);
    logger.info("tasting.updated", { tastingId, cheeses: basket.items.length });
  } catch (error) {
    // Somebody else's row reads as absent rather than forbidden, by design.
    if (error instanceof ApiError && error.code === "NOT_FOUND") {
      return {
        status: "error",
        message: "Cette dégustation n’est plus là, ou n’est pas la vôtre.",
      };
    }
    return refusal(error);
  }

  updateTag(TASTINGS_TAG);
  updateTag(CHEESES_TAG);
  updateTag(SHOPS_TAG);
  redirect("/carnet");
}

export async function removeTasting(formData: FormData): Promise<void> {
  const token = await sessionToken();
  const tastingId = formData.get("tastingId");
  if (token === null || typeof tastingId !== "string") redirect("/carnet");

  try {
    await deleteTasting(tastingId, token);
    logger.info("tasting.removed", { tastingId });
  } catch (error) {
    logger.warn("tasting.removeFailed", { tastingId, reason: String(error) });
  }

  updateTag(TASTINGS_TAG);
  updateTag(CHEESES_TAG);
  redirect("/carnet");
}
