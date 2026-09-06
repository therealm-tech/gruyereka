import { describe, expect, it } from "vitest";
import {
  filledHoles,
  formatAverage,
  formatDay,
  formatPricePerKg,
  formatPriceRange,
  formatShopAddress,
  groupByMonth,
  parseAmountCents,
  todayIso,
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

describe("formatShopAddress", () => {
  it("puts the street before the town", () => {
    expect(
      formatShopAddress({
        street: "118 rue Vieille du Temple",
        postalCode: "75003",
        city: "Paris",
      }),
    ).toBe("118 rue Vieille du Temple · 75003 Paris");
  });

  it("drops whatever OpenStreetMap did not have", () => {
    expect(formatShopAddress({ street: null, postalCode: null, city: "Comps" })).toBe("Comps");
    expect(formatShopAddress({ street: null, postalCode: "39800", city: "Poligny" })).toBe(
      "39800 Poligny",
    );
  });
});

describe("parseAmountCents", () => {
  it("reads a comma and a dot the same way", () => {
    expect(parseAmountCents("32,50")).toBe(3250);
    expect(parseAmountCents("32.5")).toBe(3250);
    expect(parseAmountCents(" 32 ")).toBe(3200);
  });

  it("tells an empty box from a zero", () => {
    expect(parseAmountCents("")).toBeNull();
    expect(parseAmountCents("   ")).toBeNull();
    expect(parseAmountCents("0")).toBe(0);
  });

  it("refuses what it cannot read rather than rounding it", () => {
    for (const raw of ["trente", "32,555", "-5", "32€", "1e3", "1234567"]) {
      expect(parseAmountCents(raw)).toBe("unreadable");
    }
  });
});

describe("groupByMonth", () => {
  it("bands consecutive days of one month together", () => {
    const bands = groupByMonth([
      { tastedOn: "2026-09-05" },
      { tastedOn: "2026-09-01" },
      { tastedOn: "2026-08-30" },
    ]);
    expect(bands.map((band) => band.month)).toEqual(["septembre 2026", "août 2026"]);
    expect(bands[0]?.entries).toHaveLength(2);
  });

  it("opens a second band when a month comes back, because it never sorts", () => {
    const bands = groupByMonth([
      { tastedOn: "2026-09-05" },
      { tastedOn: "2026-08-30" },
      { tastedOn: "2026-09-01" },
    ]);
    expect(bands).toHaveLength(3);
  });

  it("has nothing to show for nothing", () => {
    expect(groupByMonth([])).toEqual([]);
  });
});

describe("todayIso", () => {
  it("answers the shape a date input speaks", () => {
    expect(todayIso()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
