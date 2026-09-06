const LEVELS = ["debug", "info", "warn", "error"] as const;

export type LogLevel = (typeof LEVELS)[number];
export type LogFields = Record<string, string | number | boolean | null | undefined>;

function threshold(): LogLevel {
  const configured = process.env.LOG_LEVEL;
  return LEVELS.find((level) => level === configured) ?? "info";
}

function enabled(level: LogLevel): boolean {
  return LEVELS.indexOf(level) >= LEVELS.indexOf(threshold());
}

function emit(level: LogLevel, event: string, fields: LogFields = {}): void {
  if (!enabled(level)) return;
  const line = JSON.stringify({ level, event, ...fields });
  // biome-ignore lint/suspicious/noConsole: the single sink every other module logs through.
  console[level === "debug" ? "log" : level](line);
}

/**
 * The one place the application writes diagnostics. Values go in `fields`, never
 * interpolated into `event`, so lines stay groupable.
 */
export const logger = {
  debug: (event: string, fields?: LogFields) => emit("debug", event, fields),
  info: (event: string, fields?: LogFields) => emit("info", event, fields),
  warn: (event: string, fields?: LogFields) => emit("warn", event, fields),
  error: (event: string, fields?: LogFields) => emit("error", event, fields),
};
