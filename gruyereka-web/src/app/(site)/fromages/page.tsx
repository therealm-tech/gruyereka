import type { Metadata } from "next";
import { Suspense } from "react";
import { CheeseCard } from "@/components/cheeses/CheeseCard";
import { CheeseGridSkeleton } from "@/components/cheeses/CheeseGridSkeleton";
import { Pagination } from "@/components/cheeses/Pagination";
import { SearchForm } from "@/components/cheeses/SearchForm";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PlusIcon } from "@/components/ui/Icon";
import { Notice } from "@/components/ui/Notice";
import { listCheeses } from "@/lib/api/cheeses";
import { ApiContractError, ApiError, ApiUnreachableError, sentenceFor } from "@/lib/api/errors";
import type { Page as ApiPage, Cheese } from "@/lib/api/schemas";
import { currentUser } from "@/lib/session";

const PER_PAGE = 24;

export const metadata: Metadata = {
  title: "Fromages",
  description:
    "Le catalogue des fromages notés sur Gruyereka : le lait, la pâte, l’affinage, la note moyenne et le prix au kilo relevé en boutique.",
  alternates: { canonical: "/fromages" },
};

type SearchParams = { search?: string; page?: string };

function readSearch(raw: string | undefined): string | undefined {
  const trimmed = raw?.trim();
  return trimmed === undefined || trimmed.length === 0 ? undefined : trimmed;
}

function readPage(raw: string | undefined): number {
  const parsed = Number.parseInt(raw ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

/**
 * The results stream behind a Suspense boundary rather than a segment-level
 * `loading.tsx`: a `loading.tsx` here would cover every nested route, and a
 * streaming boundary flushes the 200 before a nested page can call `notFound()`
 * or `redirect()`. A crawler would then get a 200 and an empty shell where a
 * 404 was meant — which is the whole reason this client renders on a server.
 */
async function CheeseResults({ search, page }: { search: string | undefined; page: number }) {
  const signedIn = (await currentUser()) !== null;
  let result: ApiPage<Cheese> | null = null;
  let failure: unknown = null;
  try {
    result = await listCheeses({ search, page, perPage: PER_PAGE });
  } catch (error) {
    if (
      !(
        error instanceof ApiError ||
        error instanceof ApiUnreachableError ||
        error instanceof ApiContractError
      )
    ) {
      throw error;
    }
    failure = error;
  }

  if (failure !== null) {
    return (
      <Notice
        title="Le catalogue n’a pas pu être chargé"
        code={
          failure instanceof ApiError
            ? failure.code
            : failure instanceof ApiContractError
              ? "API_OFF_CONTRACT"
              : "API_UNREACHABLE"
        }
      >
        {sentenceFor(failure)}
      </Notice>
    );
  }

  if (result === null || result.items.length === 0) {
    // An empty catalogue must not be a dead end, so a signed-out visitor is
    // pointed at the sign-in rather than at a form that would turn them away.
    return (
      <EmptyState
        title={search === undefined ? "Rien dans le catalogue" : "Aucun fromage ne correspond"}
        action={
          signedIn ? (
            <ButtonLink href="/fromages/nouveau">
              <PlusIcon />
              {search === undefined ? "Ajouter le premier fromage" : "Créer ce fromage"}
            </ButtonLink>
          ) : (
            <ButtonLink href="/connexion">Se connecter pour l’ajouter</ButtonLink>
          )
        }
      >
        {search === undefined
          ? "La première fiche est celle qu’on crée en sortant de la boutique."
          : `Personne n’a encore noté « ${search} ». Sa fiche reste à écrire.`}
      </EmptyState>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {result.items.map((cheese) => (
          <CheeseCard key={cheese.id} cheese={cheese} />
        ))}
      </div>
      <Pagination
        page={result.page}
        perPage={result.perPage}
        total={result.total}
        search={search}
      />
    </>
  );
}

export default async function CheesesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const search = readSearch(params.search);
  const page = readPage(params.page);
  const signedIn = (await currentUser()) !== null;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <h1 className="font-serif text-4xl leading-none">Fromages</h1>
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
          <SearchForm search={search} />
          {signedIn ? (
            <ButtonLink href="/fromages/nouveau" variant="ghost" className="hidden md:inline-flex">
              <PlusIcon />
              Ajouter un fromage
            </ButtonLink>
          ) : null}
        </div>
      </div>

      <Suspense key={`${search ?? ""}:${page}`} fallback={<CheeseGridSkeleton />}>
        <CheeseResults search={search} page={page} />
      </Suspense>
    </div>
  );
}
