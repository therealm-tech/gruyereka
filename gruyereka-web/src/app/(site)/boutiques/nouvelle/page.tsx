import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { NewShopForm } from "@/components/shops/NewShopForm";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { currentUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "Ajouter une boutique",
  robots: { index: false },
};

export default async function NewShopPage() {
  if ((await currentUser()) === null) redirect("/connexion");

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb trail={[{ href: "/boutiques", label: "Boutiques" }]} current="Nouvelle fiche" />
      <div className="flex flex-col gap-2">
        <h1 className="display-serif text-4xl leading-none">Ajouter une boutique</h1>
        <p className="max-w-prose text-[15px] leading-relaxed text-ink-2 text-pretty">
          Une boutique est identifiée par sa fiche OpenStreetMap, pas par son nom : c’est ce qui
          fait que deux personnes qui notent la même fromagerie tombent sur la même page.
        </p>
      </div>
      <NewShopForm />
    </div>
  );
}
