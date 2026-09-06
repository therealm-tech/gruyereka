import type { ReactNode } from "react";
import { WarningIcon } from "@/components/ui/Icon";

type Tone = "refusal" | "caution";

/**
 * What the API refused, said in French. The stable code stays visible in small
 * type: that is the part worth pasting into a bug report.
 */
export function Notice({
  tone = "refusal",
  title,
  code,
  children,
}: {
  tone?: Tone;
  title: string;
  code?: string;
  children?: ReactNode;
}) {
  const refusal = tone === "refusal";
  return (
    <div
      role="alert"
      className={
        refusal
          ? "flex gap-3 rounded-[2px] border-l-[3px] border-refusal bg-refusal-bg p-4"
          : "flex gap-3 rounded-[2px] border-l-[3px] border-orange bg-cream p-4"
      }
    >
      <WarningIcon
        className={refusal ? "mt-px shrink-0 text-refusal" : "mt-px shrink-0 text-link"}
      />
      <div className="flex flex-col gap-1.5">
        <p
          className={
            refusal ? "text-sm font-semibold text-refusal-ink" : "text-sm font-semibold text-ink-3"
          }
        >
          {title}
        </p>
        {children ? <div className="text-[13px] leading-relaxed text-ink-3">{children}</div> : null}
        {code ? <p className="font-mono text-[10px] tracking-[0.06em] text-mute">{code}</p> : null}
      </div>
    </div>
  );
}
