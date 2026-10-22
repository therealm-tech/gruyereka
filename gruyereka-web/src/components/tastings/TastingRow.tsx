import Link from "next/link";
import type { ComponentProps } from "react";
import { PinIcon, WedgeIcon } from "@/components/ui/Icon";
import { RatingHoles } from "@/components/ui/RatingHoles";
import type { Cheese, Tasting, TastingItem } from "@/lib/api/schemas";
import { formatDay, formatPricePerKg } from "@/lib/format";
import { photoPath } from "@/lib/photos";
import { ratingLabels, ratingScores } from "@/lib/vocabulary";

/** Something a row points at. `null` is a fiche deleted since, which still reads. */
export type TastingSubject = {
  label: string;
  href: ComponentProps<typeof Link>["href"];
  tone: "cheese" | "shop";
};

function Header({
  tasting,
  subject,
  mine,
  editable,
}: {
  tasting: Tasting;
  subject: TastingSubject | null | undefined;
  mine: boolean;
  editable: boolean;
}) {
  const Icon = subject?.tone === "cheese" ? WedgeIcon : PinIcon;
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <div className="flex min-w-0 items-baseline gap-2">
        {subject === undefined ? null : (
          <>
            <Icon
              className={`shrink-0 self-center ${
                subject?.tone === "cheese" ? "text-link" : "text-pine"
              }`}
              size={15}
            />
            {subject === null ? (
              <span className="text-[15px] font-semibold text-mute">Fiche retirée</span>
            ) : (
              <Link href={subject.href} className="text-[15px] font-semibold text-ink">
                {subject.label}
              </Link>
            )}
          </>
        )}
        {/* The separator belongs to the name before it; on a shop's own fiche
            there is none, and a leading middot would dangle. */}
        {mine ? (
          <span className="text-[13px] text-mute">{subject === undefined ? "vous" : "· vous"}</span>
        ) : null}
      </div>
      <div className="flex items-center gap-4">
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
  );
}

/** The visit's photos, small; each opens full size on its own. */
function Photos({ tasting }: { tasting: Tasting }) {
  if (tasting.photos.length === 0) return null;
  const day = formatDay(tasting.tastedOn);
  return (
    <ul className="flex flex-wrap gap-2" aria-label="Photos de la visite">
      {tasting.photos.map((photo, index) => {
        const path = photoPath(tasting.id, photo.id);
        return (
          <li key={photo.id}>
            <a href={path} target="_blank" rel="noopener" className="block">
              {/* biome-ignore lint/performance/noImgElement: the bucket serves these bytes behind a short-lived redirect. */}
              <img
                src={path}
                alt={`Visite du ${day}, vue ${index + 1} sur ${tasting.photos.length}`}
                loading="lazy"
                className="size-16 rounded-card border border-rule object-cover hover:border-rule-strong"
              />
            </a>
          </li>
        );
      })}
    </ul>
  );
}

function Scored({ item, name }: { item: TastingItem; name: string | null }) {
  return (
    <div className="flex flex-col gap-1 border-l-2 border-rule pl-3">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-sm font-semibold">{name ?? "Fromage retiré"}</span>
          <RatingHoles
            filled={ratingScores[item.rating]}
            label={`Noté ${ratingLabels[item.rating]}`}
          />
          <span className="text-[13px]">{ratingLabels[item.rating]}</span>
        </div>
        {item.pricePerKg === null ? null : (
          <span className="font-mono text-[13px] text-ink-2">
            {formatPricePerKg(item.pricePerKg)}
          </span>
        )}
      </div>
      {item.comment === null ? null : (
        <p className="text-sm leading-relaxed text-pretty">{item.comment}</p>
      )}
    </div>
  );
}

/**
 * A whole visit: the day, where it happened, and every cheese brought home from
 * it with its own score. Used where the visit is the subject — the carnet and a
 * shop's fiche.
 *
 * `subject` is the other end of the visit: the shop in a carnet, and nothing at
 * all on a shop's own fiche, where naming it on every row would repeat the page
 * title. `null` stands for a fiche deleted since.
 */
export function TastingRow({
  tasting,
  cheeses,
  subject,
  mine,
  editable = false,
}: {
  tasting: Tasting;
  cheeses: ReadonlyMap<string, Cheese>;
  subject?: TastingSubject | null;
  mine: boolean;
  editable?: boolean;
}) {
  return (
    <article className="flex flex-col gap-3 border-t border-rule py-4">
      <Header tasting={tasting} subject={subject} mine={mine} editable={editable} />
      <div className="flex flex-col gap-3">
        {tasting.items.map((item) => (
          <Scored key={item.id} item={item} name={cheeses.get(item.cheeseId)?.name ?? null} />
        ))}
      </div>
      <Photos tasting={tasting} />
    </article>
  );
}

/**
 * The same visit seen from one cheese. A cheese's fiche cares about its own
 * score and what it went for, not about the rest of the basket — so the rest is
 * a count rather than a list.
 */
export function CheeseTastingRow({
  tasting,
  item,
  shop,
  mine,
  editable = false,
}: {
  tasting: Tasting;
  item: TastingItem;
  shop: TastingSubject | null;
  mine: boolean;
  editable?: boolean;
}) {
  const alongside = tasting.items.length - 1;
  return (
    <article className="flex flex-col gap-2.5 border-t border-rule py-4">
      <Header tasting={tasting} subject={shop} mine={mine} editable={editable} />
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <div className="flex items-center gap-2.5">
          <RatingHoles
            filled={ratingScores[item.rating]}
            label={`Noté ${ratingLabels[item.rating]}`}
          />
          <span className="text-[13px] font-semibold">{ratingLabels[item.rating]}</span>
        </div>
        {item.pricePerKg === null ? null : (
          <span className="font-mono text-[13px] text-ink-2">
            {formatPricePerKg(item.pricePerKg)}
          </span>
        )}
      </div>
      {item.comment === null ? null : (
        <p className="text-sm leading-relaxed text-pretty">{item.comment}</p>
      )}
      {alongside > 0 ? (
        <p className="font-mono text-[11px] text-mute-2">
          Goûté avec {alongside} autre{alongside > 1 ? "s" : ""} fromage
          {alongside > 1 ? "s" : ""} ce jour-là.
        </p>
      ) : null}
      <Photos tasting={tasting} />
    </article>
  );
}
