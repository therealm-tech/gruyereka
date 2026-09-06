import { describe, expect, it } from "vitest";
import {
  filledHoles,
  formatAverage,
  formatDay,
  formatPricePerKg,
  formatPriceRange,
} from "@/lib/format";

describe("filledHoles", () => {
  it("rounds down, so a 4,6 does not promote itself to five", () => {
    expect(filledHoles(4.6)).toBe(4);
    expect(filledHoles(3.9)).toBe(3);
    expect(filledHoles(5)).toBe(5);
  });

  it("fills nothing when a cheese has no tasting yet", () => {
    expect(filledHoles(null)).toBe(0);
  });

  it("stays inside the scale whatever it is handed", () => {
    expect(filledHoles(9)).toBe(5);
    expect(filledHoles(-2)).toBe(0);
  });
});

describe("money and days", () => {
  it("writes a price per kilo in French", () => {
    expect(formatPricePerKg({ amountCents: 3200, currency: "EUR" })).toMatch(/32,00/);
    expect(formatPricePerKg({ amountCents: 3200, currency: "EUR" })).toMatch(/\/kg$/);
  });

  it("collapses a range whose ends match", () => {
    const price = { amountCents: 3200, currency: "EUR" };
    expect(formatPriceRange(price, price)).not.toMatch(/^de /);
    expect(formatPriceRange({ amountCents: 2850, currency: "EUR" }, price)).toMatch(/^de /);
  });

  it("stamps a tasting day with dots", () => {
    expect(formatDay("2026-08-30")).toBe("30.08.2026");
  });

  it("has nothing to format for a cheese nobody rated", () => {
    expect(formatAverage(null)).toBeNull();
    expect(formatAverage(4.6)).toBe("4,6");
  });
});
