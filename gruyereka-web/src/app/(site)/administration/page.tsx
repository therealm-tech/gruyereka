import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { RoleChooser } from "@/components/admin/RoleChooser";
import { ApiFailure } from "@/components/ui/ApiFailure";
import { SoftBadge } from "@/components/ui/Badge";
import { Notice } from "@/components/ui/Notice";
import { Pagination } from "@/components/ui/Pagination";
import { isTransportFailure } from "@/lib/api/errors";
import type { Page as ApiPage, User } from "@/lib/api/schemas";
import { listUsers } from "@/lib/api/users";
import { formatMonth } from "@/lib/format";
import { currentUser, sessionToken } from "@/lib/session";
import { userRoleLabels } from "@/lib/vocabulary";

const PER_PAGE = 30;

export const metadata: Metadata = {
  title: "Administration",
  robots: { index: false },
};

function readPage(raw: string | undefined): number {
  const parsed = Number.parseInt(raw ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export default async function AdministrationPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const viewer = await currentUser();
  if (viewer === null) redirect("/connexion");

  // A refusal rather than a 404: the API answers `403` here on purpose, because
  // an administration page is no secret — only its contents are.
  if (viewer.role !== "ADMIN") {
    return (
      <Notice title="Cette page est réservée aux administrateurs" code="FORBIDDEN">
        Votre compte est {userRoleLabels[viewer.role].toLowerCase()}. Seul un administrateur
        distribue les rôles.
      </Notice>
    );
  }

  const token = await sessionToken();
  if (token === null) redirect("/connexion");

  const page = readPage((await searchParams).page);
  let result: ApiPage<User>;
  try {
    result = await listUsers({ page, perPage: PER_PAGE }, token);
  } catch (error) {
    if (!isTransportFailure(error)) throw error;
    return <ApiFailure title="Les comptes n’ont pas pu être chargés" error={error} />;
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <h1 className="display-serif text-4xl leading-none">Administration</h1>
        <p className="font-mono text-xs text-mute">
          {result.total} compte{result.total > 1 ? "s" : ""}
        </p>
      </div>

      <p className="max-w-prose text-[15px] leading-relaxed text-ink-2 text-pretty">
        Un rôle prend effet tout de suite : il est relu dans la base à chaque requête, jamais porté
        par un jeton. Un modérateur corrige et supprime les dégustations et les avis de tout le
        monde ; un administrateur distribue en plus les rôles.
      </p>

      <div className="border-t border-rule">
        {result.items.map((account) => {
          const self = account.id === viewer.id;
          return (
            <div
              key={account.id}
              className="flex flex-col gap-3 border-b border-rule py-4 md:flex-row md:items-center md:justify-between md:gap-6"
            >
              <div className="flex min-w-0 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="text-[15px] font-semibold">{account.displayName}</span>
                  {self ? <SoftBadge>vous</SoftBadge> : null}
                </div>
                <span className="font-mono text-[11px] text-mute">
                  {account.email} · inscrit en {formatMonth(account.createdAt.slice(0, 10))}
                </span>
              </div>

              {/* Drawing the buttons for one's own row would only offer a move
                  the API refuses, so it says why instead. */}
              {self ? (
                <span className="shrink-0 text-[13px] text-mute md:text-right">
                  {userRoleLabels[account.role]} · un administrateur ne change pas son propre rôle
                </span>
              ) : (
                <RoleChooser userId={account.id} currentRole={account.role} />
              )}
            </div>
          );
        })}
      </div>

      <Pagination
        pathname="/administration"
        page={result.page}
        perPage={result.perPage}
        total={result.total}
      />
    </div>
  );
}
