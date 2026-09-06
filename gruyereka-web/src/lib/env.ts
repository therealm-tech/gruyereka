import "server-only";
import { z } from "zod";

/**
 * Server configuration. The web client runs as its own process in its own
 * container, so the variables take bare, conventional names.
 */
const schema = z.object({
  /** Where gruyereka-api answers, without a trailing slash. */
  API_BASE_URL: z.url(),
  /** Public origin of this app, used for canonical links and the sitemap. */
  PUBLIC_BASE_URL: z.url().default("http://localhost:3000"),
  /** The geocoder shop creation resolves against; see ADR 0002. */
  NOMINATIM_BASE_URL: z.url().default("https://nominatim.openstreetmap.org"),
  /**
   * Nominatim's usage policy refuses traffic that does not identify itself, and
   * answers a bare client with 403. Override it with a real contact when this
   * runs anywhere that is not a laptop.
   */
  NOMINATIM_USER_AGENT: z
    .string()
    .min(1)
    .default("gruyereka-web (https://github.com/therealm-tech/gruyereka)"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export type Env = z.infer<typeof schema>;

function read(): Env {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new Error(`the environment is missing or malformed: ${fields}`);
  }
  return parsed.data;
}

let cached: Env | null = null;

export function env(): Env {
  cached ??= read();
  return cached;
}
