"use server";

import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { type FormState, fieldSentences } from "@/app/actions/state";
import { CHEESES_TAG, createCheese, uploadCheesePhoto } from "@/lib/api/cheeses";
import { ApiError, ApiUnreachableError, sentenceFor } from "@/lib/api/errors";
import { ACCEPTED_PHOTO_TYPES, MAX_PHOTO_BYTES } from "@/lib/api/schemas";
import { logger } from "@/lib/logger";
import { sessionToken } from "@/lib/session";
import { MILK_TYPES, PASTE_TYPES, PROTECTED_DESIGNATIONS } from "@/lib/vocabulary";

const LABELS: Record<string, string> = {
  name: "Le nom",
  milkTypes: "Le lait",
  pasteType: "La pâte",
  designation: "Le signe de qualité",
  agingMonths: "L’affinage",
  photo: "La photo",
};

const newCheese = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Un nom est attendu.")
    .max(120, "Le nom ne peut pas dépasser 120 caractères."),
  milkTypes: z
    .array(z.enum(MILK_TYPES))
    .min(1, "Choisissez au moins un lait.")
    .max(4, "Il n’y a que quatre laits."),
  pasteType: z.enum(PASTE_TYPES, { message: "Choisissez une pâte." }),
  designation: z.enum(PROTECTED_DESIGNATIONS).nullable(),
  agingMonths: z
    .number()
    .int("L’affinage se compte en mois entiers.")
    .min(0, "Un affinage ne peut pas être négatif.")
    .max(600, "Six cents mois, c’est déjà beaucoup.")
    .nullable(),
});

function readAging(raw: FormDataEntryValue | null): number | null {
  if (typeof raw !== "string" || raw.trim().length === 0) return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

/** An untouched file input still submits an entry; only a real one counts. */
function readPhoto(raw: FormDataEntryValue | null): File | null {
  return raw instanceof File && raw.size > 0 ? raw : null;
}

/** The browser already refused the obvious cases; a form post is not a promise. */
function refusePhoto(photo: File): string | null {
  if (!ACCEPTED_PHOTO_TYPES.includes(photo.type as (typeof ACCEPTED_PHOTO_TYPES)[number])) {
    return "Seuls le JPEG, le PNG et le WebP sont acceptés.";
  }
  if (photo.size > MAX_PHOTO_BYTES) return "Cette image dépasse les 10 Mo acceptés.";
  return null;
}

export async function addCheese(_previous: FormState, formData: FormData): Promise<FormState> {
  const token = await sessionToken();
  if (token === null) {
    return { status: "error", message: "Connectez-vous pour ajouter un fromage." };
  }

  const photo = readPhoto(formData.get("photo"));
  if (photo !== null) {
    const refusal = refusePhoto(photo);
    if (refusal !== null) {
      return { status: "error", message: refusal, fields: { photo: refusal } };
    }
  }

  const designation = formData.get("designation");
  const parsed = newCheese.safeParse({
    name: formData.get("name"),
    milkTypes: formData.getAll("milkTypes"),
    pasteType: formData.get("pasteType"),
    designation: designation === null || designation === "" ? null : designation,
    agingMonths: readAging(formData.get("agingMonths")),
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      status: "error",
      message: issue?.message ?? "Le formulaire n’a pas été accepté.",
      fields: Object.fromEntries(
        parsed.error.issues.map((entry) => [entry.path.join("."), entry.message] as const),
      ),
    };
  }

  let cheeseId: string;
  try {
    const created = await createCheese(
      { ...parsed.data, milkTypes: [...parsed.data.milkTypes] },
      token,
    );
    cheeseId = created.id;
    logger.info("cheese.created", { cheeseId, withPhoto: photo !== null });
  } catch (error) {
    if (error instanceof ApiError && error.code === "CONFLICT") {
      return {
        status: "error",
        message:
          "Ce fromage existe déjà : le nom, le lait, la pâte et l’affinage forment son identité.",
      };
    }
    if (error instanceof ApiError) {
      const fields = fieldSentences(error.fields, LABELS);
      return fields === undefined
        ? { status: "error", message: sentenceFor(error) }
        : { status: "error", message: sentenceFor(error), fields };
    }
    if (error instanceof ApiUnreachableError) {
      return { status: "error", message: sentenceFor(error) };
    }
    throw error;
  }

  // The photo is a second call on a cheese that now exists, so a failure here
  // cannot be undone by refusing the form: the fiche is still the right place
  // to land, and it says what did not make it.
  let photoLanded = true;
  if (photo !== null) {
    try {
      await uploadCheesePhoto(cheeseId, photo, token);
    } catch (error) {
      photoLanded = false;
      logger.warn("cheese.photoRefused", { cheeseId, reason: String(error) });
    }
  }

  updateTag(CHEESES_TAG);
  redirect(photoLanded ? `/fromages/${cheeseId}` : `/fromages/${cheeseId}?photo=echec`);
}
