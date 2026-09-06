import "server-only";
import type { z } from "zod";
import {
  ApiContractError,
  ApiError,
  ApiUnreachableError,
  type FieldErrors,
} from "@/lib/api/errors";
import { errorResponseSchema } from "@/lib/api/schemas";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

export type QueryValue = string | number | boolean | undefined;

/** Next augments the global `RequestInit`, but only once `next-env.d.ts` exists. */
type FetchInit = RequestInit & {
  next?: { revalidate?: number | false; tags?: string[] };
};

type BaseOptions = {
  path: string;
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  /** A multipart body. Mutually exclusive with `body`. */
  formData?: FormData;
  /** Bearer token, when the operation needs one. */
  token?: string | undefined;
  query?: Record<string, QueryValue>;
  /** Seconds of shared cache for a GET; `false` opts out. Reads only. */
  revalidate?: number | false;
  tags?: readonly string[];
};

function url(path: string, query: Record<string, QueryValue> | undefined): string {
  const target = new URL(`/api/v1${path}`, env().API_BASE_URL);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) target.searchParams.set(key, String(value));
  }
  return target.toString();
}

async function send(options: BaseOptions): Promise<Response> {
  const method = options.method ?? "GET";
  const target = url(options.path, options.query);
  const headers: Record<string, string> = { accept: "application/json" };
  if (options.body !== undefined) headers["content-type"] = "application/json";
  if (options.token !== undefined) headers.authorization = `Bearer ${options.token}`;

  // Built up rather than declared in one literal: under
  // `exactOptionalPropertyTypes` an explicit `undefined` is not the same as an
  // absent key, and `fetch` refuses it.
  const init: FetchInit = { method, headers };
  if (options.formData !== undefined) {
    // Never set content-type by hand here: fetch has to write it, because only
    // it knows the multipart boundary it generated.
    init.body = options.formData;
  } else if (options.body !== undefined) {
    init.body = JSON.stringify(options.body);
  }
  if (method === "GET") {
    init.next = { revalidate: options.revalidate ?? 30, tags: [...(options.tags ?? [])] };
  } else {
    init.cache = "no-store";
  }

  const started = Date.now();
  let response: Response;
  try {
    response = await fetch(target, init);
  } catch (cause) {
    logger.error("api.unreachable", { method, path: options.path });
    throw new ApiUnreachableError(`${method} ${options.path} could not be reached`, { cause });
  }

  logger.debug("api.done", {
    method,
    path: options.path,
    status: response.status,
    ms: Date.now() - started,
  });

  if (!response.ok) throw await toApiError(response, options.path);
  return response;
}

async function toApiError(response: Response, path: string): Promise<Error> {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    logger.error("api.offContract", { path, status: response.status, reason: "not json" });
    return new ApiContractError(
      `${path} answered ${response.status} without a JSON body`,
      response.status,
    );
  }
  const parsed = errorResponseSchema.safeParse(payload);
  if (!parsed.success) {
    logger.error("api.offContract", { path, status: response.status, reason: "unknown shape" });
    return new ApiContractError(
      `${path} answered ${response.status} off-contract`,
      response.status,
    );
  }
  const fields = parsed.data.fields as FieldErrors | undefined;
  logger.warn("api.refused", { path, status: response.status, code: parsed.data.code });
  return new ApiError(parsed.data.code, response.status, parsed.data.message, fields);
}

/** Calls the API and parses the body, so a drifting contract fails loudly here. */
export async function apiRequest<T>(options: BaseOptions & { schema: z.ZodType<T> }): Promise<T> {
  const response = await send(options);
  const parsed = options.schema.safeParse(await response.json());
  if (!parsed.success) {
    logger.error("api.offContract", { path: options.path, issues: parsed.error.issues.length });
    throw new ApiContractError(`${options.path} answered a body this client cannot read`);
  }
  return parsed.data;
}

/** For the operations that answer `204 No Content`. */
export async function apiRequestNoContent(options: BaseOptions): Promise<void> {
  await send(options);
}
