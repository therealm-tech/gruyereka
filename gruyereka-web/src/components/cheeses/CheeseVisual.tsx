import { CheeseMark } from "@/components/brand/CheeseMark";
import { pasteTints } from "@/lib/tints";
import type { PasteType } from "@/lib/vocabulary";

/**
 * Photos belong to visits, not to cheeses: a fiche is framed by the cheese
 * symbol on the colour of its paste, which already says what kind it is.
 */
export function CheeseVisual({
  pasteType,
  height,
  markSize,
}: {
  pasteType: PasteType;
  height: number;
  markSize: number;
}) {
  return (
    <div
      className="flex w-full items-center justify-center border-b border-rule"
      style={{ height, backgroundColor: pasteTints[pasteType].ground }}
    >
      <CheeseMark size={markSize} />
    </div>
  );
}
