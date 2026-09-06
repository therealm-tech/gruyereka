import type { PasteType } from "@/lib/vocabulary";

/**
 * A colour per paste, and the colour is the point: each one is taken from the
 * cheese it names, so a fiche is recognisable before its label is read. They
 * sit at one low saturation, and a screen only ever shows the pastes it lists —
 * which is what keeps a catalogue from turning into a rainbow.
 *
 * Kept out of `vocabulary.ts`, which turns codes into words and nothing else.
 * Both are keyed on the same closed set, so `Record<PasteType, …>` makes the
 * compiler ask for a tint whenever a paste is added.
 */
export type PasteTint = {
  /** Fills the photo slot when a fiche has no photo of its own. */
  ground: string;
  /** The same hue, dark enough to read as small text on the paper. */
  ink: string;
};

export const pasteTints: Record<PasteType, PasteTint> = {
  FRESH: { ground: "#E7EDEA", ink: "#58746B" },
  SOFT_BLOOMY_RIND: { ground: "#EDE6D2", ink: "#796D4D" },
  SOFT_WASHED_RIND: { ground: "#F2D9B8", ink: "#9B6027" },
  PRESSED_UNCOOKED: { ground: "#EFE0BE", ink: "#886B2E" },
  PRESSED_COOKED: { ground: "#E8C77A", ink: "#956317" },
  BLUE_VEINED: { ground: "#CFD8DE", ink: "#4E6377" },
  STRETCHED_CURD: { ground: "#F0EADC", ink: "#786F59" },
  PROCESSED: { ground: "#E2E0DA", ink: "#726E65" },
};
