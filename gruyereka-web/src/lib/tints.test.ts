import { describe, expect, it } from "vitest";
import { pasteTints } from "@/lib/tints";
import { PASTE_TYPES } from "@/lib/vocabulary";

const HEX = /^#[0-9A-F]{6}$/;

/** Relative luminance, the WCAG way, for the contrast checks below. */
function luminance(hex: string): number {
  const channel = (pair: string) => {
    const value = Number.parseInt(pair, 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  const r = channel(hex.slice(1, 3));
  const g = channel(hex.slice(3, 5));
  const b = channel(hex.slice(5, 7));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05);
}

describe("the paste tints", () => {
  it("gives every paste a pair", () => {
    for (const paste of PASTE_TYPES) {
      expect(pasteTints[paste].ground).toMatch(HEX);
      expect(pasteTints[paste].ink).toMatch(HEX);
    }
  });

  it("gives no two pastes the same ground, which is the whole point", () => {
    const grounds = PASTE_TYPES.map((paste) => pasteTints[paste].ground);
    expect(new Set(grounds).size).toBe(PASTE_TYPES.length);
  });

  it("keeps each ink readable on the paper the meta line sits on", () => {
    for (const paste of PASTE_TYPES) {
      // 4.5:1 is the WCAG floor for body text; the meta line is small.
      expect(contrast(pasteTints[paste].ink, "#FAF6EE")).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("keeps the card's edge apart from the slot it sits on", () => {
    for (const paste of PASTE_TYPES) {
      const { ground, ink } = pasteTints[paste];
      // 3:1 is the WCAG floor for a graphical boundary.
      expect(contrast(ink, ground)).toBeGreaterThanOrEqual(3);
    }
  });

  it("keeps the cheese mark visible on every ground", () => {
    for (const paste of PASTE_TYPES) {
      // The mark's outline; a ground that swallowed it would leave an empty slot.
      expect(contrast(pasteTints[paste].ground, "#EE7714")).toBeGreaterThanOrEqual(1.6);
    }
  });
});
