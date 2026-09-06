import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { currentUser } from "@/lib/session";

export default async function SiteLayout({ children }: { children: ReactNode }) {
  const user = await currentUser();
  return <AppShell user={user}>{children}</AppShell>;
}
