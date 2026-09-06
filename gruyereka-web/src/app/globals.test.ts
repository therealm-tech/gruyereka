import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * The palette pairings the layouts commit to, checked against the tokens
 * themselves. What this guards is the mistake that produced it: a hover state
 * that made text harder to read than before it was pointed at.
 */

// Vitest runs from the package root, and its `import.meta.url` is not a
// file URL, so the tokens are read by path rather than relative to here.
const css = readFileSync("src/app/globals.css", "utf8");

function token(name: string): string {
  const found = new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})`).exec(css);
  if (found?.[1] === undefined) throw new Error(`no --color-${name} in globals.css`);
  return found[1];
}

function luminance(hex: string): number {
  const channel = (pair: string) => {
    const value = Number.parseInt(pair, 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return (
    0.2126 * channel(hex.slice(1, 3)) +
    0.7152 * channel(hex.slice(3, 5)) +
    0.0722 * channel(hex.slice(5, 7))
  );
}

function contrast(ink: string, ground: string): number {
  const [light, dark] = [luminance(token(ink)), luminance(token(ground))].sort((a, b) => b - a);
  return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05);
}

/** Ink, ground, and where the pair is used. */
const PAIRS: readonly [string, string, string][] = [
  ["ink", "paper", "body text"],
  ["ink-2", "paper", "secondary text"],
  ["ink-3", "paper", "notice text"],
  ["link", "paper", "a link at rest"],
  ["link-hover", "paper", "a link under the pointer"],
  ["link", "cream", "a designation badge"],
  ["pine", "paper", "a shop's rating"],
  ["rail-ink", "rail", "the rail's own text"],
  ["rail-mute", "rail", "an inactive rail item"],
  ["ink", "orange", "the active rail item and the accent button"],
  ["paper", "ink", "the primary button"],
  ["refusal-ink", "refusal-bg", "a refusal notice"],
];

describe("the palette", () => {
  it.each(PAIRS)("keeps %s on %s readable, for %s", (ink, ground) => {
    expect(contrast(ink, ground)).toBeGreaterThanOrEqual(4.5);
  });

  it("darkens a link on hover rather than brightening it", () => {
    // Brightening towards `orange` was the obvious move and it dropped the
    // link to 2.4:1 — the affordance undid the legibility it advertised.
    expect(luminance(token("link-hover"))).toBeLessThan(luminance(token("link")));
    expect(token("link-hover")).not.toBe(token("link"));
  });
});
