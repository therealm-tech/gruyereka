import { PinIcon } from "@/components/ui/Icon";
import { RatingHoles } from "@/components/ui/RatingHoles";
import type { Shop, Tasting } from "@/lib/api/schemas";
import { formatDay, formatPricePerKg } from "@/lib/format";
import { ratingLabels, ratingScores } from "@/lib/vocabulary";

/**
 * One dated entry, not a rating that gets overwritten: the same cheese at the
 * same shop on another day is another row, which is why the date and the price
 * carry as much weight as the level.
 */
export function TastingRow({
  tasting,
  shop,
  mine,
}: {
  tasting: Tasting;
  shop: Shop | null;
  mine: boolean;
}) {
  const score = ratingScores[tasting.rating];
  return (
    <article className="flex flex-col gap-2.5 border-t border-rule py-4">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <div className="flex items-center gap-2">
          <PinIcon className="shrink-0 text-pine" size={15} />
          <span className="text-[15px] font-semibold">{shop?.name ?? "Boutique retirée"}</span>
          {mine ? <span className="text-[13px] text-mute">· vous</span> : null}
        </div>
        <div className="flex items-center gap-4">
          {tasting.pricePerKg === null ? null : (
            <span className="font-mono text-[13px] text-ink-2">
              {formatPricePerKg(tasting.pricePerKg)}
            </span>
          )}
          <time dateTime={tasting.tastedOn} className="font-mono text-xs text-mute">
            {formatDay(tasting.tastedOn)}
          </time>
        </div>
      </div>
      <div className="flex items-center gap-2.5">
        <RatingHoles filled={score} label={`Noté ${ratingLabels[tasting.rating]}`} />
        <span className="text-[13px] font-semibold">{ratingLabels[tasting.rating]}</span>
      </div>
      {tasting.comment === null ? null : (
        <p className="text-sm leading-relaxed text-pretty">{tasting.comment}</p>
      )}
    </article>
  );
}
