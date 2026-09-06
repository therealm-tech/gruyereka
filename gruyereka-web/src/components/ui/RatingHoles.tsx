/**
 * The holes of the logo, borrowed as the unit of rating. Orange counts a
 * cheese, pine counts a shop; the two scales are never the same colour, so they
 * stay apart even in grayscale.
 */
export type RatingTone = "cheese" | "shop";

const TONES: Record<RatingTone, string> = {
  cheese: "var(--color-orange)",
  shop: "var(--color-pine)",
};

export function RatingHoles({
  filled,
  tone = "cheese",
  size = 11,
  label,
}: {
  filled: number;
  tone?: RatingTone;
  size?: number;
  label: string;
}) {
  return (
    <div className="flex items-center gap-[3px]" role="img" aria-label={label}>
      {[1, 2, 3, 4, 5].map((step) =>
        step <= filled ? (
          <svg key={step} width={size} height={size} viewBox="0 0 12 12" aria-hidden="true">
            <circle cx="6" cy="6" r="5" fill={TONES[tone]} />
          </svg>
        ) : (
          <svg key={step} width={size} height={size} viewBox="0 0 12 12" aria-hidden="true">
            <circle
              cx="6"
              cy="6"
              r="4.2"
              fill="none"
              stroke="var(--color-rule)"
              strokeWidth="1.6"
            />
          </svg>
        ),
      )}
    </div>
  );
}
