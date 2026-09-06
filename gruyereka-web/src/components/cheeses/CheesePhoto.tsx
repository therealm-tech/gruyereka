import { CheeseMark } from "@/components/brand/CheeseMark";
import type { Cheese } from "@/lib/api/schemas";

/**
 * A fiche without a photo is the normal case, not a defect: the cheese symbol
 * fills the frame rather than a grey box apologising for itself.
 */
export function CheesePhoto({
  cheese,
  height,
  markSize,
}: {
  cheese: Pick<Cheese, "id" | "name" | "photoUrl">;
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
  return (
    <div
      className="flex w-full items-center justify-center border-b border-rule bg-paper-2"
      style={{ height }}
    >
      <CheeseMark size={markSize} />
    </div>
  );
}
