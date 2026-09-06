import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { NewCheeseForm } from "@/components/cheeses/NewCheeseForm";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { currentUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "Ajouter un fromage",
  robots: { index: false },
};

export default async function NewCheesePage() {
  if ((await currentUser()) === null) redirect("/connexion");

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb trail={[{ href: "/fromages", label: "Fromages" }]} current="Nouvelle fiche" />
      <h1 className="display-serif text-4xl leading-none">Ajouter un fromage</h1>
      <NewCheeseForm />
    </div>
  );
}
