"use server";

import { listCheeses } from "@/lib/api/cheeses";
import { isTransportFailure } from "@/lib/api/errors";
import { listShops } from "@/lib/api/shops";
import { formatShopAddress } from "@/lib/format";
import { cheeseMetaLine } from "@/lib/vocabulary";

/** One line in a picker: what is chosen, and what tells it from its namesakes. */
export type Option = { id: string; label: string; hint: string };

const LIMIT = 8;

/**
 * The two lookups behind the tasting form's pickers. They read what the public
 * listings already show, so neither needs a session; they exist as actions
 * rather than as a route so the search stays inside this app's own boundary.
 */
export async function findCheeseOptions(query: string): Promise<Option[]> {
  const search = query.trim();
  if (search.length < 2) return [];
  try {
    const page = await listCheeses({ search, perPage: LIMIT });
    return page.items.map((cheese) => ({
      id: cheese.id,
      label: cheese.name,
      hint: cheeseMetaLine(cheese.milkTypes, cheese.pasteType, cheese.agingMonths, {
        short: true,
      }),
    }));
  } catch (error) {
    if (!isTransportFailure(error)) throw error;
    return [];
  }
}

export async function findShopOptions(query: string): Promise<Option[]> {
  const search = query.trim();
  if (search.length < 2) return [];
  try {
    const page = await listShops({ search, perPage: LIMIT });
    return page.items.map((shop) => ({
      id: shop.id,
      label: shop.name,
      hint: formatShopAddress(shop),
    }));
  } catch (error) {
    if (!isTransportFailure(error)) throw error;
    return [];
  }
}
