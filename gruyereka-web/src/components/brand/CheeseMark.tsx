/**
 * The cheese symbol stands for the entity, not the brand: the frame of a card
 * and of a fiche, list rows, empty states. The pin-wheel stays the
 * mark of Gruyereka itself.
 *
 * Below about 40px the sparkle and the highlights silt up, so the compact
 * variant — silhouette and holes only — takes over.
 */
export function CheeseMark({ size, className }: { size: number; className?: string }) {
  const source = size >= 40 ? "/brand/cheese.svg" : "/brand/cheese-compact.svg";
  return (
    // biome-ignore lint/performance/noImgElement: a fixed-size SVG mark; next/image would only add a proxy hop.
    <img src={source} alt="" width={size} height={size} className={className} aria-hidden="true" />
  );
}

export function Wordmark({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <span className={`flex items-center gap-2 ${className ?? ""}`}>
      {/* biome-ignore lint/performance/noImgElement: a fixed-size SVG mark; next/image would only add a proxy hop. */}
      <img src="/brand/logo.svg" alt="" width={size} height={size} aria-hidden="true" />
      <span className="display-serif leading-none" style={{ fontSize: size + 3 }}>
        gruyereka
      </span>
    </span>
  );
}
