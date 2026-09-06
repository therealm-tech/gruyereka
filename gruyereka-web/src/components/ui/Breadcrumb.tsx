import type { Route } from "next";
import Link from "next/link";
import { ChevronRightIcon } from "@/components/ui/Icon";

/** Where this page sits, ending on the page itself, which is not a link. */
export function Breadcrumb({
  trail,
  current,
}: {
  trail: readonly { href: Route; label: string }[];
  current: string;
}) {
  return (
    <nav aria-label="Fil d’Ariane" className="flex flex-wrap items-center gap-2 text-[13px]">
      {trail.map((step) => (
        <span key={step.href} className="flex items-center gap-2">
          <Link href={step.href}>{step.label}</Link>
          <ChevronRightIcon className="text-mute-2" size={13} />
        </span>
      ))}
      <span className="font-mono text-mute">{current}</span>
    </nav>
  );
}
