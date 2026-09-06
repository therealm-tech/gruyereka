import { CheeseMark } from "@/components/brand/CheeseMark";
import type { Cheese } from "@/lib/api/schemas";
import { pasteTints } from "@/lib/tints";

/**
 * A fiche without a photo is the normal case, not a defect: the cheese symbol
 * fills the frame rather than a grey box apologising for itself.
 */
export function CheesePhoto({
  cheese,
  height,
  markSize,
}: {
  cheese: Pick<Cheese, "id" | "name" | "photoUrl" | "pasteType">;
  height: number;
  markSize: number;
}) {
  if (cheese.photoUrl !== null) {
    return (
      // biome-ignore lint/performance/noImgElement: the bucket serves these bytes behind a short-lived redirect.
      <img
        src={`/photos/${cheese.id}`}
        alt={cheese.name}
        className="w-full border-b border-rule object-cover"
        style={{ height }}
      />
    );
  }
  // No photo is the ordinary case, and the slot says which cheese it is anyway:
  // the ground is the colour of the paste.
  return (
    <div
      className="flex w-full items-center justify-center border-b border-rule"
      style={{ height, backgroundColor: pasteTints[cheese.pasteType].ground }}
    >
      <CheeseMark size={markSize} />
    </div>
  );
}
