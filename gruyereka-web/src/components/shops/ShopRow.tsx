import Link from "next/link";
import { SoftBadge } from "@/components/ui/Badge";
import { PinIcon } from "@/components/ui/Icon";
import { RatingHoles } from "@/components/ui/RatingHoles";
import type { Shop } from "@/lib/api/schemas";
import { filledHoles, formatAverage, formatShopAddress } from "@/lib/format";
import { shopKindLabels } from "@/lib/vocabulary";

/**
 * A row rather than a card: a shop has no photo, and the address is the part
 * that tells two "Fromagerie du Marché" apart. Pine throughout, so a shop's
 * rating is never mistaken for a cheese's.
 */
export function ShopRow({ shop }: { shop: Shop }) {
  const average = formatAverage(shop.averageScore);
  return (
    <Link
      href={{ pathname: `/boutiques/${shop.id}` }}
      className="flex flex-col gap-2 border-b border-rule py-4 text-ink hover:text-ink md:flex-row md:items-center md:justify-between md:gap-6"
    >
      <div className="flex min-w-0 items-start gap-2.5">
        <PinIcon className="mt-0.5 shrink-0 text-pine" size={16} />
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-[17px] font-semibold leading-tight">{shop.name}</span>
            <SoftBadge>{shopKindLabels[shop.kind]}</SoftBadge>
          </div>
          <span className="font-mono text-[11px] leading-normal text-mute">
            {formatShopAddress(shop)}
          </span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2.5 pl-[26px] md:pl-0">
        <RatingHoles
          filled={filledHoles(shop.averageScore)}
          tone="shop"
          size={11}
          label={average === null ? "Pas encore d’avis" : `Noté ${average} sur 5`}
        />
        <span className="text-xs text-mute">
          {average === null ? "Pas encore d’avis" : `${average} · ${shop.reviewCount} avis`}
        </span>
      </div>
    </Link>
  );
}
