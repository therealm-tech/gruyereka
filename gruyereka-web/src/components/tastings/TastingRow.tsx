import Link from "next/link";
import type { ComponentProps } from "react";
import { PinIcon, WedgeIcon } from "@/components/ui/Icon";
import { RatingHoles } from "@/components/ui/RatingHoles";
import type { Tasting } from "@/lib/api/schemas";
import { formatDay, formatPricePerKg } from "@/lib/format";
import { ratingLabels, ratingScores } from "@/lib/vocabulary";

/**
 * The other end of the tasting: a cheese fiche names the shop, a shop fiche
 * names the cheese, and the carnet names the cheese with the shop underneath.
 * `null` is a row whose subject was deleted, which still reads.
 */
export type TastingSubject = {
  label: string;
  href: ComponentProps<typeof Link>["href"];
  tone: "cheese" | "shop";
};

/**
 * One dated entry, not a rating that gets overwritten: the same cheese at the
 * same shop on another day is another row, which is why the date and the price
 * carry as much weight as the level.
 */
export function TastingRow({
  tasting,
  subject,
  secondary,
  mine,
  editable = false,
}: {
  tasting: Tasting;
  subject: TastingSubject | null;
  secondary?: string | undefined;
  mine: boolean;
  editable?: boolean;
}) {
  const score = ratingScores[tasting.rating];
  const Icon = subject?.tone === "cheese" ? WedgeIcon : PinIcon;

  return (
    <article className="flex flex-col gap-2.5 border-t border-rule py-4">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <div className="flex min-w-0 items-start gap-2">
          <Icon
            className={`mt-px shrink-0 ${subject?.tone === "cheese" ? "text-link" : "text-pine"}`}
            size={15}
          />
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="flex flex-wrap items-center gap-2">
              {subject === null ? (
                <span className="text-[15px] font-semibold text-mute">Fiche retirée</span>
              ) : (
                <Link href={subject.href} className="text-[15px] font-semibold text-ink">
                  {subject.label}
                </Link>
              )}
              {mine ? <span className="text-[13px] text-mute">· vous</span> : null}
            </span>
            {secondary === undefined ? null : (
              <span className="font-mono text-[11px] text-mute">{secondary}</span>
            )}
          </span>
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
          {editable ? (
            <Link
              href={{ pathname: `/degustations/${tasting.id}/modifier` }}
              className="text-[13px] font-semibold text-link"
            >
              Corriger
            </Link>
          ) : null}
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
