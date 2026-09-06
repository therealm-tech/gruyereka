"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { type FormState, fieldSentences } from "@/app/actions/state";
import { login, register } from "@/lib/api/auth";
import { ApiError, ApiUnreachableError, sentenceFor } from "@/lib/api/errors";
import { logger } from "@/lib/logger";
import { endSession, startSession } from "@/lib/session";

const LABELS: Record<string, string> = {
  email: "L’adresse e-mail",
  displayName: "Le nom affiché",
  password: "Le mot de passe",
};

const credentials = z.object({
  email: z.email("Cette adresse e-mail n’a pas l’air d’en être une."),
  password: z.string().min(1, "Un mot de passe est attendu."),
});

const registration = credentials.extend({
  displayName: z
    .string()
    .trim()
    .min(1, "Un nom affiché est attendu.")
    .max(80, "Le nom affiché ne peut pas dépasser 80 caractères."),
  password: z.string().min(12, "Le mot de passe fait 12 caractères au minimum."),
});

function firstIssue(error: z.ZodError): FormState {
  const issue = error.issues[0];
  return {
    status: "error",
    message: issue?.message ?? "Le formulaire n’a pas été accepté.",
    fields: Object.fromEntries(
      error.issues.map((entry) => [entry.path.join("."), entry.message] as const),
    ),
  };
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

export async function signIn(_previous: FormState, formData: FormData): Promise<FormState> {
  const parsed = credentials.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return firstIssue(parsed.error);

  try {
    const session = await login(parsed.data);
    await startSession(session.accessToken, session.expiresInSeconds);
    logger.info("session.started", { userId: session.user.id });
  } catch (error) {
    if (error instanceof ApiError && error.code === "UNAUTHENTICATED") {
      // The API deliberately cannot tell an unknown address from a wrong
      // password, and neither should this sentence.
      return { status: "error", message: "Cette adresse et ce mot de passe ne vont pas ensemble." };
    }
    return refusal(error);
  }
  redirect("/fromages");
}

export async function signUp(_previous: FormState, formData: FormData): Promise<FormState> {
  const parsed = registration.safeParse({
    email: formData.get("email"),
    displayName: formData.get("displayName"),
    password: formData.get("password"),
  });
  if (!parsed.success) return firstIssue(parsed.error);

  try {
    const session = await register(parsed.data);
    await startSession(session.accessToken, session.expiresInSeconds);
    logger.info("account.created", { userId: session.user.id });
  } catch (error) {
    if (error instanceof ApiError && error.code === "CONFLICT") {
      return { status: "error", message: "Un compte utilise déjà cette adresse e-mail." };
    }
    return refusal(error);
  }
  redirect("/fromages");
}

export async function signOut(): Promise<void> {
  await endSession();
  redirect("/fromages");
}
