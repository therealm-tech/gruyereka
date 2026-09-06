import Link from "next/link";
import type { ReactNode } from "react";
import { Wordmark } from "@/components/brand/CheeseMark";
import { BottomNav, RailNav } from "@/components/layout/SiteNav";
import { ButtonLink } from "@/components/ui/Button";
import { PlusIcon } from "@/components/ui/Icon";
import type { User } from "@/lib/api/schemas";
import { userRoleLabels } from "@/lib/vocabulary";

function initials(displayName: string): string {
  return displayName
    .split(/\s+/)
    .filter((part) => part.length > 0)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function Account({ user, onRail = false }: { user: User | null; onRail?: boolean }) {
  if (user === null) {
    return (
      <Link
        href="/connexion"
        className={`text-sm font-semibold ${onRail ? "text-orange hover:text-amber" : ""}`}
      >
        Se connecter
      </Link>
    );
  }
  // The whole block is the way to the account, sign-out included; a rail with
  // its own log-out button would spend a permanent slot on a yearly gesture.
  return (
    <Link
      href="/profil"
      className={`flex items-center gap-2.5 ${onRail ? "text-rail-ink" : "text-ink"}`}
    >
      <span
        aria-hidden="true"
        className={`flex size-8 shrink-0 items-center justify-center rounded-full font-mono text-[11px] ${
          onRail ? "bg-rail-rule text-rail-mute" : "border border-rule bg-paper-2 text-ink-2"
        }`}
      >
        {initials(user.displayName)}
      </span>
      <span className="flex flex-col gap-px">
        <span className={`text-sm font-semibold ${onRail ? "text-rail-ink" : ""}`}>
          {user.displayName}
        </span>
        <span className={`font-mono text-[10px] ${onRail ? "text-rail-mute" : "text-mute"}`}>
          {userRoleLabels[user.role]}
        </span>
      </span>
    </Link>
  );
}

/**
 * Mobile is the base layout: a slim header and a bottom bar. The 240px rail is
 * layered on from `md` upwards, never the other way round.
 */
export function AppShell({ user, children }: { user: User | null; children: ReactNode }) {
  return (
    <div className="flex min-h-dvh">
      <aside className="hidden w-60 shrink-0 flex-col bg-rail px-4 pt-6 pb-5 md:flex">
        <Link href="/fromages" className="px-2 pb-6 text-rail-ink">
          <Wordmark size={24} />
        </Link>
        <RailNav admin={user?.role === "ADMIN"} />
        {user === null ? null : (
          <div className="pt-4">
            <ButtonLink href="/degustations/nouvelle" variant="accent" className="w-full">
              <PlusIcon />
              Noter une dégustation
            </ButtonLink>
          </div>
        )}
        <div className="grow" />
        <div className="border-t border-rail-rule px-2 pt-4">
          <Account user={user} onRail />
        </div>
      </aside>

      <div className="flex min-w-0 grow flex-col">
        <header className="flex items-center justify-between border-b border-rule px-5 py-3.5 md:hidden">
          <Link href="/fromages" className="text-ink">
            <Wordmark size={22} />
          </Link>
          <Account user={user} />
        </header>

        <main className="grow px-5 pt-6 pb-28 md:px-10 md:pt-8 md:pb-12">{children}</main>
      </div>

      <BottomNav admin={user?.role === "ADMIN"} />
    </div>
  );
}
