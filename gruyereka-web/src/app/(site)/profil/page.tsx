import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { signOut } from "@/app/actions/auth";
import { SoftBadge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { BookIcon } from "@/components/ui/Icon";
import { isTransportFailure } from "@/lib/api/errors";
import { listTastings } from "@/lib/api/tastings";
import { formatMonth } from "@/lib/format";
import { currentUser } from "@/lib/session";
import { userRoleDescriptions, userRoleLabels } from "@/lib/vocabulary";

export const metadata: Metadata = {
  title: "Profil",
  robots: { index: false },
};

function initials(displayName: string): string {
  return displayName
    .split(/\s+/)
    .filter((part) => part.length > 0)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

/** Only the count, which one page of one entry already carries as `total`. */
async function tastingCount(userId: string): Promise<number | null> {
  try {
    return (await listTastings({ userId, perPage: 1 })).total;
  } catch (error) {
    if (!isTransportFailure(error)) throw error;
    return null;
  }
}

function Field({ label, children }: { label: string; children: string }) {
  return (
    <div className="flex flex-col gap-1 border-t border-rule py-3.5">
      <span className="label-mono">{label}</span>
      <span className="text-[15px]">{children}</span>
    </div>
  );
}

export default async function ProfilePage() {
  const user = await currentUser();
  if (user === null) redirect("/connexion");

  const tastings = await tastingCount(user.id);

  return (
    <div className="flex w-full flex-col gap-8 lg:w-[620px]">
      <div className="flex items-center gap-4">
        <span
          aria-hidden="true"
          className="flex size-16 shrink-0 items-center justify-center rounded-full border border-rule bg-paper-2 font-mono text-lg text-ink-2"
        >
          {initials(user.displayName)}
        </span>
        <div className="flex min-w-0 flex-col gap-2">
          <h1 className="display-serif text-4xl leading-none">{user.displayName}</h1>
          <div className="flex flex-wrap gap-2">
            <SoftBadge>{userRoleLabels[user.role]}</SoftBadge>
          </div>
        </div>
      </div>

      <p className="text-[15px] leading-relaxed text-ink-2 text-pretty">
        {userRoleDescriptions[user.role]}
      </p>

      <section className="flex flex-col">
        <Field label="Adresse e-mail">{user.email}</Field>
        <Field label="Membre depuis">{formatMonth(user.createdAt.slice(0, 10))}</Field>
        <Field label="Dégustations notées">
          {tastings === null
            ? "Le compte n’a pas pu être chargé"
            : `${tastings} dégustation${tastings > 1 ? "s" : ""}`}
        </Field>
      </section>

      <div className="flex flex-wrap gap-3">
        <ButtonLink href="/carnet" variant="ghost">
          <BookIcon size={16} />
          Ouvrir le carnet
        </ButtonLink>
      </div>

      {/* No endpoint changes an account: the API exposes registration, sign-in
          and the role, and nothing else. Saying so beats a form that would have
          nowhere to post. */}
      <section className="flex flex-col gap-3 border-t border-rule pt-6">
        <h2 className="label-mono">Se déconnecter</h2>
        <p className="text-[13px] leading-relaxed text-ink-2 text-pretty">
          Le nom, l’adresse et le mot de passe ne se changent pas depuis ici. La déconnexion efface
          la session de ce navigateur ; elle n’en ferme aucune autre.
        </p>
        <form action={signOut}>
          <button
            type="submit"
            className="h-10 rounded-card border border-ink px-4 text-sm font-semibold"
          >
            Se déconnecter
          </button>
        </form>
      </section>
    </div>
  );
}
