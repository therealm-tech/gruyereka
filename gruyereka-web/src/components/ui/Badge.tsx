import type { ReactNode } from "react";

/** An outlined badge for a quality scheme: AOP, AOC, IGP, STG. */
export function DesignationBadge({ children }: { children: ReactNode }) {
  return (
    <span className="flex h-[22px] shrink-0 items-center rounded-[2px] border border-link px-2 font-mono text-[11px] tracking-[0.06em] text-link">
      {children}
    </span>
  );
}

/** A filled badge for anything that is a category rather than a distinction. */
export function SoftBadge({ children }: { children: ReactNode }) {
  return (
    <span className="flex h-[22px] shrink-0 items-center rounded-[2px] bg-paper-2 px-2 font-mono text-[11px] text-ink-2">
      {children}
    </span>
  );
}
