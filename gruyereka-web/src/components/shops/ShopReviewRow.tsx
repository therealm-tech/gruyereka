import { removeMyReview } from "@/app/actions/shops";
import { RatingHoles } from "@/components/ui/RatingHoles";
import type { ShopReview } from "@/lib/api/schemas";
import { formatDay } from "@/lib/format";

/**
 * An opinion of a shop is a current position rather than an event, so a review
 * carries the day it was last written and nothing else — no history, unlike a
 * tasting.
 */
export function ShopReviewRow({ review, mine }: { review: ShopReview; mine: boolean }) {
  return (
    <article className="flex flex-col gap-2 border-t border-rule py-4">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <div className="flex items-center gap-2.5">
          <RatingHoles filled={review.score} tone="shop" label={`Noté ${review.score} sur 5`} />
          {mine ? <span className="text-[13px] text-mute">· vous</span> : null}
        </div>
        <div className="flex items-center gap-4">
          <time dateTime={review.updatedAt} className="font-mono text-xs text-mute">
            {formatDay(review.updatedAt.slice(0, 10))}
          </time>
          {mine ? (
            <form action={removeMyReview}>
              <input type="hidden" name="shopId" value={review.shopId} />
              <button type="submit" className="text-[13px] font-semibold text-link">
                Retirer
              </button>
            </form>
          ) : null}
        </div>
      </div>
      {review.comment === null ? null : (
        <p className="text-sm leading-relaxed text-pretty">{review.comment}</p>
      )}
    </article>
  );
}
