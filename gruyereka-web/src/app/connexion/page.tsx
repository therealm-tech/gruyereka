import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/AuthForm";
import { CheeseMark, Wordmark } from "@/components/brand/CheeseMark";
import { currentUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "Connexion",
  description: "Se connecter à Gruyereka pour noter ses dégustations et les boutiques.",
  robots: { index: false },
};

export default async function SignInPage() {
  if ((await currentUser()) !== null) redirect("/fromages");

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <aside className="flex shrink-0 flex-col justify-between gap-10 bg-ink px-6 py-8 text-paper md:w-[600px] md:px-14 md:py-11">
        <Link href="/fromages" className="text-paper hover:text-paper">
          <Wordmark size={26} />
        </Link>
        <div className="flex flex-col gap-6 md:gap-8">
          <CheeseMark size={132} className="hidden md:block" />
          <p className="display-serif text-3xl leading-tight text-pretty md:text-5xl">
            Le carnet de vos fromages, et de ceux qui les vendent.
          </p>
          <p className="max-w-md text-base leading-relaxed text-mute-2 text-pretty md:text-[17px]">
            Le jour, la boutique, le prix au kilo. Rien de tout cela ne tient dans une note sur cinq
            — alors on garde les quatre.
          </p>
        </div>
        <p className="font-mono text-xs text-mute">Gratuit · sans publicité · code ouvert</p>
      </aside>

      <div className="flex grow items-center justify-center px-6 py-10 md:px-10">
        <AuthForm />
      </div>
    </div>
  );
}
