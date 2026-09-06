import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ShopReviewForm } from "@/components/shops/ShopReviewForm";
import { ShopReviewRow } from "@/components/shops/ShopReviewRow";
import { TastingRow } from "@/components/tastings/TastingRow";
import { SoftBadge } from "@/components/ui/Badge";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { ButtonLink } from "@/components/ui/Button";
import { PlusIcon } from "@/components/ui/Icon";
import { RatingHoles } from "@/components/ui/RatingHoles";
import { getCheese } from "@/lib/api/cheeses";
import { ApiError } from "@/lib/api/errors";
import type { Cheese, Shop, ShopReview } from "@/lib/api/schemas";
import { getShop, listShopReviews } from "@/lib/api/shops";
import { listTastings } from "@/lib/api/tastings";
import { filledHoles, formatAverage, formatShopAddress } from "@/lib/format";
import { currentUser } from "@/lib/session";
import { shopKindLabels } from "@/lib/vocabulary";

const REVIEWS_SHOWN = 50;
const TASTINGS_SHOWN = 20;

async function loadShop(shopId: string): Promise<Shop> {
  try {
    return await getShop(shopId);
  } catch (error) {
    if (error instanceof ApiError && error.code === "NOT_FOUND") notFound();
    throw error;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ shopId: string }>;
}): Promise<Metadata> {
  const { shopId } = await params;
  let shop: Shop;
  try {
    shop = await getShop(shopId);
  } catch {
    return { title: "Boutique introuvable" };
  }

  const average = formatAverage(shop.averageScore);
  const description =
    average === null
      ? `${shop.name} — ${shopKindLabels[shop.kind]} à ${shop.city}. Pas encore d’avis.`
      : `${shop.name} — ${shopKindLabels[shop.kind]} à ${shop.city}. Notée ${average} sur 5 sur ${shop.reviewCount} avis, avec les fromages qui y ont été achetés.`;

  return {
    title: `${shop.name}, ${shop.city}`,
    description,
    alternates: { canonical: `/boutiques/${shop.id}` },
    openGraph: { title: shop.name, description, type: "website" },
  };
}

/** schema.org `Store`, so a shop's page can surface as a place, not just a link. */
function structuredData(shop: Shop): string {
  const payload: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Store",
    name: shop.name,
    address: {
      "@type": "PostalAddress",
      ...(shop.street === null ? {} : { streetAddress: shop.street }),
      ...(shop.postalCode === null ? {} : { postalCode: shop.postalCode }),
      addressLocality: shop.city,
      addressCountry: shop.countryCode,
    },
    geo: { "@type": "GeoCoordinates", latitude: shop.latitude, longitude: shop.longitude },
  };
  if (shop.averageScore !== null && shop.reviewCount > 0) {
    payload.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: shop.averageScore,
      reviewCount: shop.reviewCount,
      bestRating: 5,
      worstRating: 1,
    };
  }
  // A name carrying `</script>` would otherwise close the block early.
  return JSON.stringify(payload).replaceAll("<", "\\u003c");
}

export default async function ShopPage({ params }: { params: Promise<{ shopId: string }> }) {
  const { shopId } = await params;
  const [shop, reviews, tastings, viewer] = await Promise.all([
    loadShop(shopId),
    listShopReviews({ shopId, perPage: REVIEWS_SHOWN }),
    listTastings({ shopId, perPage: TASTINGS_SHOWN }),
    currentUser(),
  ]);

  const cheeseIds = [
    ...new Set(tastings.items.flatMap((tasting) => tasting.items.map((one) => one.cheeseId))),
  ];
  const cheeses = new Map<string, Cheese>();
  await Promise.all(
    cheeseIds.map(async (cheeseId) => {
      try {
        cheeses.set(cheeseId, await getCheese(cheeseId));
      } catch {
        // A cheese deleted since the tasting was written leaves the row readable.
      }
    }),
  );

  const average = formatAverage(shop.averageScore);
  // There is no endpoint for "my review", so it is looked for in the page that
  // was fetched. Past that page the form opens blank and still overwrites on
  // submit, since the API keys a review on its author.
  const mine: ShopReview | null =
    viewer === null ? null : (reviews.items.find((review) => review.userId === viewer.id) ?? null);
  const osmUrl = `https://www.openstreetmap.org/${shop.osm.element.toLowerCase()}/${shop.osm.id}`;

  return (
    <div className="flex flex-col gap-6">
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD is a script body; escaped above.
        dangerouslySetInnerHTML={{ __html: structuredData(shop) }}
      />

      <Breadcrumb trail={[{ href: "/boutiques", label: "Boutiques" }]} current={shop.name} />

      <div className="flex flex-col gap-8 lg:flex-row lg:gap-10">
        <div className="flex w-full shrink-0 flex-col gap-5 lg:w-[400px]">
          <div className="flex flex-col gap-3">
            {/* In a column, a bare badge stretches to the whole width. */}
            <div className="flex flex-wrap gap-2">
              <SoftBadge>{shopKindLabels[shop.kind]}</SoftBadge>
            </div>
            <h1 className="display-serif text-5xl leading-none">{shop.name}</h1>
            <p className="text-[15px] text-ink-2">{formatShopAddress(shop)}</p>
          </div>

          <div className="flex flex-col gap-3 border-t border-b border-rule py-4">
            <div className="flex items-center gap-3">
              <RatingHoles
                filled={filledHoles(shop.averageScore)}
                tone="shop"
                size={14}
                label={average === null ? "Pas encore d’avis" : `Notée ${average} sur 5`}
              />
              <span className="font-mono text-xs text-ink-2">
                {average === null ? "Pas encore d’avis" : `${average} · ${shop.reviewCount} avis`}
              </span>
            </div>
            <a
              href={osmUrl}
              rel="noreferrer noopener external"
              target="_blank"
              className="font-mono text-[11px]"
            >
              Voir sur OpenStreetMap ↗
            </a>
          </div>

          {viewer === null ? null : <ShopReviewForm shopId={shop.id} mine={mine} />}
        </div>

        <div className="flex min-w-0 grow flex-col gap-8">
          <section className="flex flex-col">
            <div className="flex flex-wrap items-baseline justify-between gap-3 pb-3">
              <h2 className="display-serif text-3xl">Ce qu’on y a acheté</h2>
              {viewer === null ? null : (
                <ButtonLink
                  href={{ pathname: "/degustations/nouvelle", query: { boutique: shop.id } }}
                  variant="ghost"
                >
                  <PlusIcon />
                  Noter une dégustation
                </ButtonLink>
              )}
            </div>
            {tastings.items.length === 0 ? (
              <p className="border-t border-rule py-6 text-sm text-ink-2 text-pretty">
                Aucune dégustation n’a encore été notée ici.
              </p>
            ) : (
              tastings.items.map((tasting) => {
                const own = viewer !== null && viewer.id === tasting.userId;
                return (
                  <TastingRow
                    key={tasting.id}
                    tasting={tasting}
                    cheeses={cheeses}
                    mine={own}
                    editable={own}
                  />
                );
              })
            )}
          </section>

          <section className="flex flex-col">
            <h2 className="pb-3 display-serif text-3xl">Les avis</h2>
            {reviews.items.length === 0 ? (
              <p className="border-t border-rule py-6 text-sm text-ink-2 text-pretty">
                Personne n’a encore donné son avis sur cette boutique.
              </p>
            ) : (
              reviews.items.map((review) => (
                <ShopReviewRow
                  key={review.id}
                  review={review}
                  mine={viewer !== null && viewer.id === review.userId}
                />
              ))
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
