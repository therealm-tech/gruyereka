"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { BookIcon, PinIcon, WedgeIcon } from "@/components/ui/Icon";

type NavItem = {
  href: Route;
  label: string;
  icon: (props: { size?: number; className?: string }) => ReactNode;
};

/**
 * Only the sections that exist. A nav entry pointing at a 404 is worse than a
 * short nav.
 */
const ITEMS: readonly NavItem[] = [
  { href: "/fromages", label: "Fromages", icon: WedgeIcon },
  { href: "/boutiques", label: "Boutiques", icon: PinIcon },
  { href: "/carnet", label: "Carnet", icon: BookIcon },
];

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function RailNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Sections" className="flex flex-col gap-0.5">
      {ITEMS.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex h-[42px] items-center gap-3 rounded-card px-3 text-[15px] ${
              active ? "bg-orange font-semibold text-ink" : "text-rail-mute hover:text-rail-ink"
            }`}
          >
            <Icon size={20} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Sections"
      className="fixed inset-x-0 bottom-0 z-10 flex border-t border-rule bg-paper pt-2.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:hidden"
    >
      {ITEMS.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-11 grow flex-col items-center justify-center gap-1 ${
              active ? "font-semibold text-ink" : "text-mute hover:text-ink"
            }`}
          >
            <Icon size={22} />
            <span className="text-[11px]">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
