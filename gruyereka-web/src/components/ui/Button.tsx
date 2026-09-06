import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Variant = "primary" | "ghost" | "accent";

const STYLES: Record<Variant, string> = {
  primary: "bg-ink text-paper",
  ghost: "border border-ink text-ink",
  // For a dark ground: on the rail, ink on ink reads as nothing.
  accent: "bg-orange text-ink",
};

const SHAPE =
  "inline-flex h-10 items-center justify-center gap-2 rounded-card px-[18px] text-sm font-semibold";

export function Button({
  variant = "primary",
  className,
  children,
  ...rest
}: ComponentProps<"button"> & { variant?: Variant }) {
  return (
    <button type="button" className={`${SHAPE} ${STYLES[variant]} ${className ?? ""}`} {...rest}>
      {children}
    </button>
  );
}

export function ButtonLink({
  href,
  variant = "primary",
  className,
  children,
}: {
  href: ComponentProps<typeof Link>["href"];
  variant?: Variant;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={`${SHAPE} ${STYLES[variant]} ${className ?? ""}`}>
      {children}
    </Link>
  );
}
