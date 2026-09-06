import type { ReactNode } from "react";
import { CheeseMark } from "@/components/brand/CheeseMark";

export function EmptyState({
  title,
  children,
  action,
  faded = false,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  faded?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-5 py-14 text-center">
      <CheeseMark size={58} className={faded ? "opacity-35" : "opacity-55"} />
      <h2 className="font-serif text-2xl leading-tight">{title}</h2>
      {children ? (
        <p className="max-w-sm text-[13px] leading-relaxed text-ink-2 text-pretty">{children}</p>
      ) : null}
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  );
}
