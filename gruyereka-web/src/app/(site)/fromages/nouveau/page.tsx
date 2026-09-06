import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { NewCheeseForm } from "@/components/cheeses/NewCheeseForm";
import { ChevronRightIcon } from "@/components/ui/Icon";
import { currentUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "Ajouter un fromage",
  robots: { index: false },
};

export default async function NewCheesePage() {
  if ((await currentUser()) === null) redirect("/connexion");

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Fil d’Ariane" className="flex items-center gap-2 text-[13px]">
        <Link href="/fromages">Fromages</Link>
        <ChevronRightIcon className="text-mute-2" size={13} />
        <span className="font-mono text-mute">Nouvelle fiche</span>
      </nav>
      <h1 className="font-serif text-4xl leading-none">Ajouter un fromage</h1>
      <NewCheeseForm />
    </div>
  );
}
