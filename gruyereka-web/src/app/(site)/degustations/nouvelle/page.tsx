import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { findCheeseOptions, findShopOptions, type Option } from "@/app/actions/pick";
import { TastingForm } from "@/components/tastings/TastingForm";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { getCheese } from "@/lib/api/cheeses";
import { getShop } from "@/lib/api/shops";
import { formatShopAddress, todayIso } from "@/lib/format";
import { currentUser } from "@/lib/session";
import { cheeseMetaLine } from "@/lib/vocabulary";

export const metadata: Metadata = {
  title: "Noter une dégustation",
  robots: { index: false },
};

/** Prefilled from wherever the button was pressed; an unknown id just opens blank. */
async function cheeseOption(cheeseId: string | undefined): Promise<Option | null> {
  if (cheeseId === undefined) return null;
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

async function shopOption(shopId: string | undefined): Promise<Option | null> {
  if (shopId === undefined) return null;
  try {
    const shop = await getShop(shopId);
    return { id: shop.id, label: shop.name, hint: formatShopAddress(shop) };
  } catch {
    return null;
  }
}

export default async function NewTastingPage({
  searchParams,
}: {
  searchParams: Promise<{ fromage?: string; boutique?: string }>;
}) {
  if ((await currentUser()) === null) redirect("/connexion");

  const { fromage, boutique } = await searchParams;
  const [cheese, shop] = await Promise.all([cheeseOption(fromage), shopOption(boutique)]);

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb trail={[{ href: "/carnet", label: "Carnet" }]} current="Nouvelle dégustation" />
      <div className="flex flex-col gap-2">
        <h1 className="display-serif text-4xl leading-none">Noter une dégustation</h1>
        <p className="max-w-prose text-[15px] leading-relaxed text-ink-2 text-pretty">
          Une dégustation est datée : le même fromage racheté ailleurs, ou plus tard, s’ajoute au
          lieu de remplacer. C’est ce qui fait l’historique des prix.
        </p>
      </div>
      <TastingForm
        existing={null}
        cheese={cheese}
        shop={shop}
        today={todayIso()}
        findCheeses={findCheeseOptions}
        findShops={findShopOptions}
      />
    </div>
  );
}
