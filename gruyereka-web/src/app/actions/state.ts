import type { FieldErrors } from "@/lib/api/errors";

/** What a form gets back from its action, for `useActionState`. */
export type FormState =
  | { status: "idle" }
  | { status: "error"; message: string; fields?: Readonly<Record<string, string>> };

export const IDLE: FormState = { status: "idle" };

/**
 * The API answers with the offending field names and `validator` codes. The
 * codes are a contract, not prose, so each field gets one French sentence
 * rather than a machine word shown to somebody.
 */
export function fieldSentences(
  fields: FieldErrors | undefined,
  labels: Readonly<Record<string, string>>,
): Readonly<Record<string, string>> | undefined {
  if (fields === undefined) return undefined;
  const sentences: Record<string, string> = {};
  for (const name of Object.keys(fields)) {
    const label = labels[name] ?? name;
    sentences[name] = `${label} n’a pas été accepté par le serveur.`;
  }
  return sentences;
}
