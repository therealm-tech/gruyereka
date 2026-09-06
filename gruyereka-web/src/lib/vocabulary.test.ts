import { describe, expect, it } from "vitest";
import {
  cheeseMetaLine,
  MILK_TYPES,
  milkLabels,
  PASTE_TYPES,
  PROTECTED_DESIGNATIONS,
  pasteLabels,
  pasteShortLabels,
  RATING_LEVELS,
  ratingLabels,
  ratingScores,
  SHOP_KINDS,
  shopKindLabels,
  USER_ROLES,
  userRoleDescriptions,
  userRoleLabels,
} from "@/lib/vocabulary";

describe("the translation bundle", () => {
  it("gives every code a word, so nothing reaches a reader as SCREAMING_SNAKE", () => {
    for (const code of MILK_TYPES) expect(milkLabels[code]).toBeTruthy();
    for (const code of PASTE_TYPES) expect(pasteLabels[code]).toBeTruthy();
    for (const code of PASTE_TYPES) expect(pasteShortLabels[code]).toBeTruthy();
    for (const code of RATING_LEVELS) expect(ratingLabels[code]).toBeTruthy();
    for (const code of SHOP_KINDS) expect(shopKindLabels[code]).toBeTruthy();
    for (const code of USER_ROLES) expect(userRoleLabels[code]).toBeTruthy();
    for (const code of USER_ROLES) expect(userRoleDescriptions[code]).toBeTruthy();
    expect(PROTECTED_DESIGNATIONS).toHaveLength(4);
  });

  it("orders the scale the way the database averages it", () => {
    expect(RATING_LEVELS.map((level) => ratingScores[level])).toEqual([1, 2, 3, 4, 5]);
  });

  it("only shortens the two soft pastes", () => {
    const shortened = PASTE_TYPES.filter((code) => pasteShortLabels[code] !== pasteLabels[code]);
    expect(shortened).toEqual(["SOFT_BLOOMY_RIND", "SOFT_WASHED_RIND"]);
  });
});

describe("cheeseMetaLine", () => {
  it("reads milk, paste and ageing in that order", () => {
    expect(cheeseMetaLine(["COW"], "PRESSED_COOKED", 36)).toBe("Vache · Pressée cuite · 36 mois");
  });

  it("says nothing about an ageing nobody stated", () => {
    expect(cheeseMetaLine(["COW"], "BLUE_VEINED", null)).toBe("Vache · Persillée");
  });

  it("joins several milks", () => {
    expect(cheeseMetaLine(["COW", "GOAT"], "FRESH", null)).toBe("Vache, Chèvre · Frais");
  });

  it("takes the short paste only when asked", () => {
    expect(cheeseMetaLine(["GOAT"], "SOFT_BLOOMY_RIND", 3, { short: true })).toBe(
      "Chèvre · Croûte fleurie · 3 mois",
    );
  });
});
