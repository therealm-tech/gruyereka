/**
 * The stable failure codes gruyereka-api answers with, and the French sentence
 * each one becomes. `message` on the wire is English prose for whoever reads a
 * response by hand — it is never shown to a person.
 */
export const API_ERROR_CODES = [
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "UNKNOWN_REFERENCE",
  "VALIDATION_FAILED",
  "BAD_REQUEST",
  "INTERNAL_ERROR",
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export type FieldErrors = Readonly<Record<string, readonly string[]>>;

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly fields: FieldErrors | undefined;

  constructor(code: ApiErrorCode, status: number, message: string, fields?: FieldErrors) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.fields = fields;
  }
}

/** The API could not be reached at all. */
export class ApiUnreachableError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "ApiUnreachableError";
  }
}

/**
 * The API answered, but with something this client cannot read: a body off the
 * documented shape, or a failure that never went through `ErrorResponse`. A
 * different fault from an unreachable server, and worth saying so.
 */
export class ApiContractError extends Error {
  readonly status: number | undefined;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "ApiContractError";
    this.status = status;
  }
}

const SENTENCES: Record<ApiErrorCode, string> = {
  UNAUTHENTICATED: "Votre session a expiré. Reconnectez-vous pour continuer.",
  FORBIDDEN: "Vous n’avez pas le droit de faire cela.",
  NOT_FOUND: "Cette fiche n’existe plus.",
  CONFLICT: "Ce fromage existe déjà : même nom, même lait, même pâte, même affinage.",
  UNKNOWN_REFERENCE: "Une des références a disparu pendant que vous écriviez.",
  VALIDATION_FAILED: "Le formulaire n’a pas été accepté tel quel.",
  BAD_REQUEST: "La demande n’a pas été comprise.",
  INTERNAL_ERROR: "Le serveur n’a rien dit. Rien n’a été perdu, réessayez.",
};

export function sentenceFor(error: unknown): string {
  if (error instanceof ApiError) return SENTENCES[error.code];
  if (error instanceof ApiUnreachableError) {
    return "Le serveur est injoignable. Réessayez dans un instant.";
  }
  if (error instanceof ApiContractError) {
    return "Le serveur a répondu quelque chose que ce client ne sait pas lire.";
  }
  return "Quelque chose s’est mal passé.";
}

export function isApiError(error: unknown, code: ApiErrorCode): error is ApiError {
  return error instanceof ApiError && error.code === code;
}

/**
 * The three ways a call can fail without the page itself being broken: a
 * refusal, an unreachable server, a body off contract. Anything else is a bug
 * in this client and belongs on the error boundary, so a listing rethrows it.
 */
export function isTransportFailure(
  error: unknown,
): error is ApiError | ApiUnreachableError | ApiContractError {
  return (
    error instanceof ApiError ||
    error instanceof ApiUnreachableError ||
    error instanceof ApiContractError
  );
}

/** The stable code to show in small type, whichever of the three it was. */
export function codeOf(error: ApiError | ApiUnreachableError | ApiContractError): string {
  if (error instanceof ApiError) return error.code;
  return error instanceof ApiContractError ? "API_OFF_CONTRACT" : "API_UNREACHABLE";
}
