import Link from "next/link";
import { CheeseVisual } from "@/components/cheeses/CheeseVisual";
import { DesignationBadge } from "@/components/ui/Badge";
import { RatingHoles } from "@/components/ui/RatingHoles";
import type { Cheese } from "@/lib/api/schemas";
import { filledHoles, formatAverage } from "@/lib/format";
import { pasteTints } from "@/lib/tints";
import { cheeseMetaLine } from "@/lib/vocabulary";

export function CheeseCard({ cheese }: { cheese: Cheese }) {
  const average = formatAverage(cheese.averageScore);
  const meta = cheeseMetaLine(cheese.milkTypes, cheese.pasteType, cheese.agingMonths, {
    short: true,
  });
  const tint = pasteTints[cheese.pasteType];

  return (
    <Link
      href={{ pathname: `/fromages/${cheese.id}` }}
      className="flex flex-col overflow-hidden rounded-card border border-rule bg-white text-ink hover:border-rule-strong"
    >
      <div className="h-[3px] w-full" style={{ backgroundColor: tint.ink }} />
      <CheeseVisual pasteType={cheese.pasteType} height={140} markSize={60} />
      <div className="flex flex-col gap-[7px] p-3.5">
        <div className="flex min-h-11 items-start justify-between gap-2.5">
          <span className="display-serif text-xl leading-tight">{cheese.name}</span>
          {cheese.designation === null ? null : (
            <DesignationBadge>{cheese.designation}</DesignationBadge>
          )}
        </div>
        <span className="min-h-8 font-mono text-[10px] leading-normal" style={{ color: tint.ink }}>
          {meta}
        </span>
        <div className="flex items-center gap-2.5 pt-0.5">
          <RatingHoles
            filled={filledHoles(cheese.averageScore)}
            size={10}
            label={
              average === null
                ? "Pas encore noté"
                : `Noté ${average} sur 5, ${cheese.tastingCount} dégustations`
            }
          />
          <span className="text-xs text-mute">
            {average === null
              ? "Pas encore noté"
              : `${average} · ${cheese.tastingCount} dégustation${cheese.tastingCount > 1 ? "s" : ""}`}
          </span>
        </div>
      </div>
    </Link>
  );
}
