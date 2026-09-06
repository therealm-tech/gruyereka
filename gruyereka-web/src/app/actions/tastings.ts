"use server";

import { revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { type FormState, fieldSentences } from "@/app/actions/state";
import { CHEESES_TAG } from "@/lib/api/cheeses";
import { ApiError, ApiUnreachableError, sentenceFor } from "@/lib/api/errors";
import type { PricePerKg } from "@/lib/api/schemas";
import { SHOPS_TAG } from "@/lib/api/shops";
import { createTasting, deleteTasting, TASTINGS_TAG, updateTasting } from "@/lib/api/tastings";
import { parseAmountCents, todayIso } from "@/lib/format";
import { logger } from "@/lib/logger";
import { sessionToken } from "@/lib/session";
import { CURRENCIES, RATING_LEVELS } from "@/lib/vocabulary";

const LABELS: Record<string, string> = {
  cheeseId: "Le fromage",
  shopId: "La boutique",
  rating: "La note",
  pricePerKg: "Le prix au kilo",
  tastedOn: "La date",
  comment: "Le commentaire",
};

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

function readCents(raw: FormDataEntryValue | null): number | null | "unreadable" {
  return typeof raw === "string" ? parseAmountCents(raw) : null;
}

const entry = z.object({
  rating: z.enum(RATING_LEVELS, { message: "Dites ce que vous en avez pensé." }),
  tastedOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "La date n’est pas lisible.")
    .refine((value) => value >= "1900-01-01", "Cette date est trop ancienne.")
    // A log entry is something that happened; tomorrow has not.
    .refine((value) => value <= todayIso(), "On ne note pas une dégustation à venir."),
  currency: z.enum(CURRENCIES),
  comment: z
    .string()
    .trim()
    .max(2000, "Le commentaire ne peut pas dépasser 2000 caractères.")
    .transform((value) => (value.length === 0 ? null : value)),
});

const created = entry.extend({ cheeseId: z.uuid(), shopId: z.uuid() });

type Parsed = z.infer<typeof entry>;

function price(parsed: Parsed, cents: number | null): PricePerKg | null {
  return cents === null ? null : { amountCents: cents, currency: parsed.currency };
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

const PRICE_REFUSED = "Le prix au kilo s’écrit en euros, par exemple 32,50.";

export async function addTasting(_previous: FormState, formData: FormData): Promise<FormState> {
  const token = await sessionToken();
  if (token === null) {
    return { status: "error", message: "Connectez-vous pour noter une dégustation." };
  }

  const cents = readCents(formData.get("pricePerKg"));
  if (cents === "unreadable") {
    return { status: "error", message: PRICE_REFUSED, fields: { pricePerKg: PRICE_REFUSED } };
  }

  const parsed = created.safeParse({
    cheeseId: formData.get("cheeseId"),
    shopId: formData.get("shopId"),
    rating: formData.get("rating"),
    tastedOn: formData.get("tastedOn"),
    currency: formData.get("currency") ?? "EUR",
    comment: formData.get("comment") ?? "",
  });
  if (!parsed.success) return firstIssue(parsed.error);

  try {
    const tasting = await createTasting(
      {
        cheeseId: parsed.data.cheeseId,
        shopId: parsed.data.shopId,
        rating: parsed.data.rating,
        pricePerKg: price(parsed.data, cents),
        comment: parsed.data.comment,
        tastedOn: parsed.data.tastedOn,
      },
      token,
    );
    logger.info("tasting.created", { tastingId: tasting.id, cheeseId: parsed.data.cheeseId });
  } catch (error) {
    if (error instanceof ApiError && error.code === "UNKNOWN_REFERENCE") {
      return {
        status: "error",
        message: "Le fromage ou la boutique a disparu pendant que vous écriviez.",
      };
    }
    return refusal(error);
  }

  // The average and the tasting count live on the cheese, so its fiche and every
  // listing showing it are stale the moment this lands.
  revalidateTag(TASTINGS_TAG);
  revalidateTag(CHEESES_TAG);
  redirect(`/fromages/${parsed.data.cheeseId}`);
}

export async function editTasting(_previous: FormState, formData: FormData): Promise<FormState> {
  const token = await sessionToken();
  if (token === null) {
    return { status: "error", message: "Connectez-vous pour corriger une dégustation." };
  }

  const tastingId = formData.get("tastingId");
  const cheeseId = formData.get("cheeseId");
  if (typeof tastingId !== "string" || typeof cheeseId !== "string") {
    return { status: "error", message: "Cette dégustation n’a pas pu être retrouvée." };
  }

  const cents = readCents(formData.get("pricePerKg"));
  if (cents === "unreadable") {
    return { status: "error", message: PRICE_REFUSED, fields: { pricePerKg: PRICE_REFUSED } };
  }

  const parsed = entry.safeParse({
    rating: formData.get("rating"),
    tastedOn: formData.get("tastedOn"),
    currency: formData.get("currency") ?? "EUR",
    comment: formData.get("comment") ?? "",
  });
  if (!parsed.success) return firstIssue(parsed.error);

  try {
    await updateTasting(
      tastingId,
      {
        rating: parsed.data.rating,
        pricePerKg: price(parsed.data, cents),
        comment: parsed.data.comment,
        tastedOn: parsed.data.tastedOn,
      },
      token,
    );
    logger.info("tasting.updated", { tastingId });
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

  revalidateTag(TASTINGS_TAG);
  revalidateTag(CHEESES_TAG);
  revalidateTag(SHOPS_TAG);
  redirect(`/fromages/${cheeseId}`);
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

  revalidateTag(TASTINGS_TAG);
  revalidateTag(CHEESES_TAG);
  redirect("/carnet");
}
