/**
 * The translation bundle. gruyereka-api never localises: closed vocabularies
 * travel as stable codes and every client holds its own wording. This file is
 * that wording for the French web client, and the only place a code becomes a
 * word.
 */

export const MILK_TYPES = ["COW", "GOAT", "SHEEP", "BUFFALO"] as const;
export type MilkType = (typeof MILK_TYPES)[number];

export const PASTE_TYPES = [
  "FRESH",
  "SOFT_BLOOMY_RIND",
  "SOFT_WASHED_RIND",
  "PRESSED_UNCOOKED",
  "PRESSED_COOKED",
  "BLUE_VEINED",
  "STRETCHED_CURD",
  "PROCESSED",
] as const;
export type PasteType = (typeof PASTE_TYPES)[number];

export const PROTECTED_DESIGNATIONS = ["AOP", "AOC", "IGP", "STG"] as const;
export type ProtectedDesignation = (typeof PROTECTED_DESIGNATIONS)[number];

export const RATING_LEVELS = ["INEDIBLE", "POOR", "MEH", "GOOD", "DELICIOUS"] as const;
export type RatingLevel = (typeof RATING_LEVELS)[number];

export const SHOP_KINDS = ["CHEESEMONGER", "MARKET", "SUPERMARKET", "FARM", "OTHER"] as const;
export type ShopKind = (typeof SHOP_KINDS)[number];

export const OSM_ELEMENTS = ["NODE", "WAY", "RELATION"] as const;
export type OsmElement = (typeof OSM_ELEMENTS)[number];

/**
 * Not a vocabulary the API closes — it takes any ISO 4217 code — but the list
 * the tasting form offers, so a price cannot be entered against a typo.
 */
export const CURRENCIES = ["EUR", "CHF", "GBP"] as const;
export type Currency = (typeof CURRENCIES)[number];

export const USER_ROLES = ["USER", "MODERATOR", "ADMIN"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const milkLabels: Record<MilkType, string> = {
  COW: "Vache",
  GOAT: "Chèvre",
  SHEEP: "Brebis",
  BUFFALO: "Bufflonne",
};

export const pasteLabels: Record<PasteType, string> = {
  FRESH: "Frais",
  SOFT_BLOOMY_RIND: "Molle à croûte fleurie",
  SOFT_WASHED_RIND: "Molle à croûte lavée",
  PRESSED_UNCOOKED: "Pressée non cuite",
  PRESSED_COOKED: "Pressée cuite",
  BLUE_VEINED: "Persillée",
  STRETCHED_CURD: "Filée",
  PROCESSED: "Fondu",
};

/**
 * Only for a list row too narrow for the full label; everywhere else the label
 * above is the one wording. The two soft pastes are the only ones that differ.
 */
export const pasteShortLabels: Record<PasteType, string> = {
  ...pasteLabels,
  SOFT_BLOOMY_RIND: "Croûte fleurie",
  SOFT_WASHED_RIND: "Croûte lavée",
};

export const ratingLabels: Record<RatingLevel, string> = {
  INEDIBLE: "Immangeable",
  POOR: "Médiocre",
  MEH: "Bof",
  GOOD: "Bon",
  DELICIOUS: "Délicieux",
};

/** The ordinal the database averages on, so a level renders as N filled holes. */
export const ratingScores: Record<RatingLevel, 1 | 2 | 3 | 4 | 5> = {
  INEDIBLE: 1,
  POOR: 2,
  MEH: 3,
  GOOD: 4,
  DELICIOUS: 5,
};

export const shopKindLabels: Record<ShopKind, string> = {
  CHEESEMONGER: "Fromagerie",
  MARKET: "Marché",
  SUPERMARKET: "Supermarché",
  FARM: "Ferme",
  OTHER: "Autre",
};

export const currencyLabels: Record<Currency, string> = {
  EUR: "€ euro",
  CHF: "CHF franc suisse",
  GBP: "£ livre sterling",
};

export const userRoleLabels: Record<UserRole, string> = {
  USER: "Utilisateur",
  MODERATOR: "Modérateur",
  ADMIN: "Administrateur",
};

/** Milk, paste and ageing, as one line under a cheese name. */
export function cheeseMetaLine(
  milkTypes: readonly MilkType[],
  pasteType: PasteType,
  agingMonths: number | null,
  { short = false }: { short?: boolean } = {},
): string {
  const paste = short ? pasteShortLabels[pasteType] : pasteLabels[pasteType];
  const parts = [milkTypes.map((milk) => milkLabels[milk]).join(", "), paste];
  if (agingMonths !== null) parts.push(`${agingMonths} mois`);
  return parts.join(" · ");
}
