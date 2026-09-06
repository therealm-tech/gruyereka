import type { PricePerKg, Shop } from "@/lib/api/schemas";

const DATE = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});
const MONTH = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" });
const AVERAGE = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** `2026-08-30` as `30.08.2026`. Dots, because a tasting date is a log stamp. */
export function formatDay(isoDate: string): string {
  return DATE.format(new Date(`${isoDate}T00:00:00Z`)).replaceAll("/", ".");
}

/** `2026-08-30` as `août 2026`, for the bands that group a log by month. */
export function formatMonth(isoDate: string): string {
  return MONTH.format(new Date(`${isoDate}T00:00:00Z`));
}

/** Minor units and an ISO 4217 code as `32,00 €/kg`. */
export function formatPricePerKg(price: PricePerKg): string {
  const amount = new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: price.currency,
  }).format(price.amountCents / 100);
  return `${amount}/kg`;
}

/** `4.6` as `4,6`; nothing to say when a cheese has no tasting yet. */
export function formatAverage(average: number | null): string | null {
  return average === null ? null : AVERAGE.format(average);
}

/**
 * How many of the five holes are filled. Rounded down on purpose: a 4,6 shows
 * four full holes rather than promoting itself to five.
 */
export function filledHoles(average: number | null): number {
  return average === null ? 0 : Math.max(0, Math.min(5, Math.floor(average)));
}

/** `28.5` and `32` as `de 28,50 à 32,00 €`, or a single price when they match. */
export function formatPriceRange(low: PricePerKg, high: PricePerKg): string {
  const money = (price: PricePerKg) =>
    new Intl.NumberFormat("fr-FR", { style: "currency", currency: price.currency }).format(
      price.amountCents / 100,
    );
  return low.amountCents === high.amountCents ? money(low) : `de ${money(low)} à ${money(high)}`;
}

/**
 * `118 rue Vieille du Temple · 75003 Paris`, dropping whatever OpenStreetMap did
 * not have. The city is the only part a shop always carries.
 */
export function formatShopAddress(shop: Pick<Shop, "street" | "postalCode" | "city">): string {
  const town = [shop.postalCode, shop.city].filter((part) => part !== null).join(" ");
  return shop.street === null ? town : `${shop.street} · ${town}`;
}

/**
 * Today as `YYYY-MM-DD` in the running process's zone, which is what a date
 * input speaks. Used to cap a tasting's day: a log entry is something that
 * happened, and tomorrow has not.
 */
export function todayIso(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

/**
 * The other direction of `formatPricePerKg`, for what somebody types: `32,50`
 * and `32.5` both give 3250, an empty box gives `null` — no price was noted,
 * which is not the same as a price of zero — and anything else is refused
 * rather than silently rounded into a number.
 */
export function parseAmountCents(raw: string): number | null | "unreadable" {
  const cleaned = raw.trim().replaceAll(/\s/g, "").replace(",", ".");
  if (cleaned.length === 0) return null;
  if (!/^\d{1,6}(\.\d{1,2})?$/.test(cleaned)) return "unreadable";
  return Math.round(Number.parseFloat(cleaned) * 100);
}

/**
 * Consecutive runs of one month, in the order they arrive. The API returns a
 * log newest first, so the bands come out newest first too — this does not sort,
 * on purpose, because a listing that is not chronological should not be made to
 * look like it is.
 */
export function groupByMonth<T extends { tastedOn: string }>(
  entries: readonly T[],
): { month: string; entries: T[] }[] {
  const bands: { month: string; entries: T[] }[] = [];
  for (const entry of entries) {
    const month = formatMonth(entry.tastedOn);
    const last = bands.at(-1);
    if (last?.month === month) last.entries.push(entry);
    else bands.push({ month, entries: [entry] });
  }
  return bands;
}
