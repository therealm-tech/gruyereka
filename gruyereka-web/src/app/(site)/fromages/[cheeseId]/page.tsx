import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CheeseVisual } from "@/components/cheeses/CheeseVisual";
import { CheeseTastingRow, type TastingSubject } from "@/components/tastings/TastingRow";
import { DesignationBadge, SoftBadge } from "@/components/ui/Badge";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { ButtonLink } from "@/components/ui/Button";
import { PlusIcon } from "@/components/ui/Icon";
import { RatingHoles } from "@/components/ui/RatingHoles";
import { getCheese } from "@/lib/api/cheeses";
import { ApiError } from "@/lib/api/errors";
import type { Cheese, PricePerKg, Shop, Tasting } from "@/lib/api/schemas";
import { getShop } from "@/lib/api/shops";
import { listTastings } from "@/lib/api/tastings";
import { filledHoles, formatAverage, formatPriceRange } from "@/lib/format";
import { currentUser } from "@/lib/session";
import { cheeseMetaLine, milkLabels, pasteLabels } from "@/lib/vocabulary";

const TASTINGS_SHOWN = 20;

async function loadCheese(cheeseId: string): Promise<Cheese> {
  try {
    return await getCheese(cheeseId);
  } catch (error) {
    if (error instanceof ApiError && error.code === "NOT_FOUND") notFound();
    throw error;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ cheeseId: string }>;
}): Promise<Metadata> {
  const { cheeseId } = await params;
  let cheese: Cheese;
  try {
    cheese = await getCheese(cheeseId);
  } catch {
    return { title: "Fromage introuvable" };
  }

  const meta = cheeseMetaLine(cheese.milkTypes, cheese.pasteType, cheese.agingMonths);
  const average = formatAverage(cheese.averageScore);
  const description =
    average === null
      ? `${cheese.name} — ${meta}. Pas encore de dégustation notée.`
      : `${cheese.name} — ${meta}. Noté ${average} sur 5 sur ${cheese.tastingCount} dégustations, avec les prix au kilo relevés en boutique.`;

  return {
    title: cheese.name,
    description,
    alternates: { canonical: `/fromages/${cheese.id}` },
    openGraph: { title: cheese.name, description, type: "article" },
  };
}

/** The shop side of a row, absent when the shop was deleted since. */
function subjectOf(shop: Shop | undefined): TastingSubject | null {
  return shop === undefined
    ? null
    : { label: shop.name, href: { pathname: `/boutiques/${shop.id}` }, tone: "shop" };
}

/** What this cheese went for, visit by visit; the rest of a basket is not ours. */
function pricesOf(tastings: readonly Tasting[], cheeseId: string): PricePerKg[] {
  return tastings
    .map((tasting) => tasting.items.find((item) => item.cheeseId === cheeseId)?.pricePerKg ?? null)
    .filter((price): price is PricePerKg => price !== null);
}

/** The prices of the currency most recently used, so a range never mixes them. */
function priceRange(prices: readonly PricePerKg[]): { low: PricePerKg; high: PricePerKg } | null {
  const newest = prices[0];
  if (newest === undefined) return null;
  const sameCurrency = prices.filter((price) => price.currency === newest.currency);
  const amounts = sameCurrency.map((price) => price.amountCents);
  const low = Math.min(...amounts);
  const high = Math.max(...amounts);
  return {
    low: { amountCents: low, currency: newest.currency },
    high: { amountCents: high, currency: newest.currency },
  };
}

/** schema.org, so a shared fiche unfurls with its rating instead of a bare link. */
function structuredData(cheese: Cheese, shops: number): string {
  const payload: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: cheese.name,
    category: "Fromage",
    additionalProperty: [
      {
        "@type": "PropertyValue",
        name: "Lait",
        value: cheese.milkTypes.map((milk) => milkLabels[milk]).join(", "),
      },
      { "@type": "PropertyValue", name: "Pâte", value: pasteLabels[cheese.pasteType] },
      ...(cheese.agingMonths === null
        ? []
        : [{ "@type": "PropertyValue", name: "Affinage", value: `${cheese.agingMonths} mois` }]),
      ...(cheese.designation === null
        ? []
        : [{ "@type": "PropertyValue", name: "Signe de qualité", value: cheese.designation }]),
    ],
  };
  if (cheese.averageScore !== null && cheese.tastingCount > 0) {
    payload.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: cheese.averageScore,
      reviewCount: cheese.tastingCount,
      bestRating: 5,
      worstRating: 1,
    };
  }
  if (shops > 0) payload.offers = { "@type": "AggregateOffer", offerCount: shops };
  // A name carrying `</script>` would otherwise close the block early.
  return JSON.stringify(payload).replaceAll("<", "\\u003c");
}

export default async function CheesePage({ params }: { params: Promise<{ cheeseId: string }> }) {
  const { cheeseId } = await params;
  const [cheese, tastings, viewer] = await Promise.all([
    loadCheese(cheeseId),
    listTastings({ cheeseId, perPage: TASTINGS_SHOWN }),
    currentUser(),
  ]);

  const shopIds = [...new Set(tastings.items.map((tasting) => tasting.shopId))];
  const shops = new Map<string, Shop>();
  await Promise.all(
    shopIds.map(async (shopId) => {
      try {
        shops.set(shopId, await getShop(shopId));
      } catch {
        // A shop deleted since the tasting was written leaves the row readable.
      }
    }),
  );

  const average = formatAverage(cheese.averageScore);
  const range = priceRange(pricesOf(tastings.items, cheese.id));
  const remaining = tastings.total - tastings.items.length;

  return (
    <div className="flex flex-col gap-6">
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD is a script body; escaped above.
        dangerouslySetInnerHTML={{ __html: structuredData(cheese, shops.size) }}
      />

      <Breadcrumb trail={[{ href: "/fromages", label: "Fromages" }]} current={cheese.name} />

      <div className="flex flex-col gap-8 lg:flex-row lg:gap-10">
        <div className="flex w-full shrink-0 flex-col gap-4.5 lg:w-[400px]">
          <div className="overflow-hidden rounded-card border border-rule">
            <CheeseVisual pasteType={cheese.pasteType} height={260} markSize={96} />
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              {cheese.designation === null ? null : (
                <DesignationBadge>{cheese.designation}</DesignationBadge>
              )}
              {cheese.agingMonths === null ? null : (
                <SoftBadge>{cheese.agingMonths} mois d’affinage</SoftBadge>
              )}
            </div>
            <h1 className="display-serif text-5xl leading-none">{cheese.name}</h1>
            <p className="text-[15px] text-ink-2">
              {cheese.milkTypes
                .map((milk) => `Lait de ${milkLabels[milk].toLowerCase()}`)
                .join(", ")}
              {" · Pâte "}
              {pasteLabels[cheese.pasteType].toLowerCase()}
            </p>
          </div>

          <div className="flex flex-col gap-3 border-t border-b border-rule py-4">
            <div className="flex items-center gap-3">
              <RatingHoles
                filled={filledHoles(cheese.averageScore)}
                size={14}
                label={average === null ? "Pas encore noté" : `Noté ${average} sur 5`}
              />
              <span className="font-mono text-xs text-ink-2">
                {average === null
                  ? "Pas encore de dégustation"
                  : `${average} · ${cheese.tastingCount} dégustation${cheese.tastingCount > 1 ? "s" : ""}`}
              </span>
            </div>
            {range === null ? null : (
              <div className="flex items-baseline gap-2.5">
                <span className="font-mono text-[17px]">
                  {formatPriceRange(range.low, range.high)}
                </span>
                <span className="font-mono text-xs text-mute">
                  par kilo · {shops.size} boutique{shops.size > 1 ? "s" : ""}
                </span>
              </div>
            )}
          </div>
        </div>

        <section className="flex min-w-0 grow flex-col">
          <div className="flex flex-wrap items-baseline justify-between gap-3 pb-3">
            <h2 className="display-serif text-3xl">Les dégustations</h2>
            {viewer === null ? null : (
              <ButtonLink
                href={{ pathname: "/degustations/nouvelle", query: { fromage: cheese.id } }}
                variant="ghost"
              >
                <PlusIcon />
                Noter une dégustation
              </ButtonLink>
            )}
          </div>
          {tastings.items.length === 0 ? (
            <p className="border-t border-rule py-6 text-sm text-ink-2 text-pretty">
              Personne ne l’a encore goûté. La première dégustation ouvrira aussi son historique de
              prix.
            </p>
          ) : (
            <>
              {tastings.items.map((tasting) => {
                const item = tasting.items.find((one) => one.cheeseId === cheese.id);
                // The listing filters on this cheese, so a visit without it
                // would mean the API and this page disagree.
                if (item === undefined) return null;
                const own = viewer !== null && viewer.id === tasting.userId;
                return (
                  <CheeseTastingRow
                    key={tasting.id}
                    tasting={tasting}
                    item={item}
                    shop={subjectOf(shops.get(tasting.shopId))}
                    mine={own}
                    editable={own}
                  />
                );
              })}
              {remaining > 0 ? (
                <p className="border-t border-rule py-4 font-mono text-xs text-mute">
                  {remaining} dégustation{remaining > 1 ? "s" : ""} de plus, non affichée
                  {remaining > 1 ? "s" : ""}.
                </p>
              ) : null}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
