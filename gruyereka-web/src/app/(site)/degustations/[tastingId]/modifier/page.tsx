import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { findCheeseOptions, findShopOptions, type Option } from "@/app/actions/pick";
import { removeTasting } from "@/app/actions/tastings";
import { PhotoManager } from "@/components/tastings/PhotoManager";
import { type BasketRow, TastingForm } from "@/components/tastings/TastingForm";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { getCheese } from "@/lib/api/cheeses";
import { ApiError } from "@/lib/api/errors";
import type { Tasting } from "@/lib/api/schemas";
import { getShop } from "@/lib/api/shops";
import { getTasting } from "@/lib/api/tastings";
import { formatAmountForInput, formatShopAddress, todayIso } from "@/lib/format";
import { currentUser } from "@/lib/session";
import { CURRENCIES, type Currency, cheeseMetaLine } from "@/lib/vocabulary";

export const metadata: Metadata = {
  title: "Corriger une dégustation",
  robots: { index: false },
};

async function loadTasting(tastingId: string): Promise<Tasting> {
  try {
    return await getTasting(tastingId);
  } catch (error) {
    if (error instanceof ApiError && error.code === "NOT_FOUND") notFound();
    throw error;
  }
}

async function cheeseOption(cheeseId: string): Promise<Option | null> {
  try {
    const cheese = await getCheese(cheeseId);
    return {
      id: cheese.id,
      label: cheese.name,
      hint: cheeseMetaLine(cheese.milkTypes, cheese.pasteType, cheese.agingMonths, {
        short: true,
      }),
    };
  } catch {
    return null;
  }
}

async function shopOption(shopId: string): Promise<Option | null> {
  try {
    const shop = await getShop(shopId);
    return { id: shop.id, label: shop.name, hint: formatShopAddress(shop) };
  } catch {
    return null;
  }
}

/**
 * The visit carries one currency, so the first priced cheese decides it. A code
 * the form does not offer falls back rather than opening a select on a value it
 * cannot show.
 */
function currencyOf(tasting: Tasting): Currency {
  const code = tasting.items.find((item) => item.pricePerKg !== null)?.pricePerKg?.currency;
  return (CURRENCIES as readonly string[]).includes(code ?? "") ? (code as Currency) : "EUR";
}

export default async function EditTastingPage({
  params,
}: {
  params: Promise<{ tastingId: string }>;
}) {
  const viewer = await currentUser();
  if (viewer === null) redirect("/connexion");

  const { tastingId } = await params;
  const tasting = await loadTasting(tastingId);
  // The API would refuse the write anyway; refusing to draw the form means
  // nobody types a correction they were never going to be allowed to save.
  if (tasting.userId !== viewer.id) notFound();

  const [shop, rows] = await Promise.all([
    shopOption(tasting.shopId),
    Promise.all(
      tasting.items.map(
        async (item): Promise<BasketRow> => ({
          cheese: await cheeseOption(item.cheeseId),
          rating: item.rating,
          price: formatAmountForInput(item.pricePerKg),
          comment: item.comment ?? "",
        }),
      ),
    ),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb trail={[{ href: "/carnet", label: "Carnet" }]} current="Correction" />
      <h1 className="display-serif text-4xl leading-none">Corriger une dégustation</h1>

      <TastingForm
        tastingId={tasting.id}
        shop={shop}
        initialRows={rows}
        currency={currencyOf(tasting)}
        today={todayIso()}
        tastedOn={tasting.tastedOn}
        findCheeses={findCheeseOptions}
        findShops={findShopOptions}
      />

      <PhotoManager tastingId={tasting.id} photos={tasting.photos} />

      <form
        action={removeTasting}
        className="flex w-full flex-col gap-3 border-t border-rule pt-6 lg:w-[680px]"
      >
        <input type="hidden" name="tastingId" value={tasting.id} />
        <h2 className="label-mono">Supprimer</h2>
        <p className="text-[13px] leading-relaxed text-ink-2 text-pretty">
          Toute la visite disparaît, avec les {tasting.items.length} fromage
          {tasting.items.length > 1 ? "s" : ""} qu’elle porte, ses photos et les prix relevés ce
          jour-là. Pour n’en retirer qu’un, enlevez sa ligne ci-dessus et enregistrez.
        </p>
        <button
          type="submit"
          className="h-10 self-start rounded-card border border-refusal px-4 text-sm font-semibold text-refusal-ink"
        >
          Supprimer cette dégustation
        </button>
      </form>
    </div>
  );
}
