import type { PricePerKg } from "@/lib/api/schemas";

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
