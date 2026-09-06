import type { Metadata } from "next";
import { Suspense } from "react";
import { ShopRow } from "@/components/shops/ShopRow";
import { ApiFailure } from "@/components/ui/ApiFailure";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PlusIcon } from "@/components/ui/Icon";
import { Pagination } from "@/components/ui/Pagination";
import { SearchForm } from "@/components/ui/SearchForm";
import { isTransportFailure } from "@/lib/api/errors";
import type { Page as ApiPage, Shop } from "@/lib/api/schemas";
import { listShops } from "@/lib/api/shops";
import { currentUser } from "@/lib/session";

const PER_PAGE = 25;

export const metadata: Metadata = {
  title: "Boutiques",
  description:
    "Les fromageries, marchés et fermes où les fromages de Gruyereka ont été achetés, avec la note laissée par ceux qui y sont passés.",
  alternates: { canonical: "/boutiques" },
};

type SearchParams = { search?: string; city?: string; page?: string };

function readText(raw: string | undefined): string | undefined {
  const trimmed = raw?.trim();
  return trimmed === undefined || trimmed.length === 0 ? undefined : trimmed;
}

function readPage(raw: string | undefined): number {
  const parsed = Number.parseInt(raw ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function ShopListSkeleton() {
  return (
    <div>
      {[0, 1, 2, 3, 4, 5].map((slot) => (
        <div key={slot} className="flex flex-col gap-2 border-b border-rule py-5">
          <div className="h-4 w-1/3 rounded-[2px] bg-paper-2" />
          <div className="h-3 w-1/2 rounded-[2px] bg-paper-3" />
        </div>
      ))}
    </div>
  );
}

async function ShopResults({
  search,
  city,
  page,
}: {
  search: string | undefined;
  city: string | undefined;
  page: number;
}) {
  const signedIn = (await currentUser()) !== null;
  let result: ApiPage<Shop>;
  try {
    result = await listShops({ search, city, page, perPage: PER_PAGE });
  } catch (error) {
    if (!isTransportFailure(error)) throw error;
    return <ApiFailure title="Les boutiques n’ont pas pu être chargées" error={error} />;
  }

  if (result.items.length === 0) {
    const filtered = search !== undefined || city !== undefined;
    return (
      <EmptyState
        title={filtered ? "Aucune boutique ne correspond" : "Aucune boutique"}
        action={
          signedIn ? (
            <ButtonLink href="/boutiques/nouvelle">
              <PlusIcon />
              Ajouter une boutique
            </ButtonLink>
          ) : (
            <ButtonLink href="/connexion">Se connecter pour l’ajouter</ButtonLink>
          )
        }
      >
        {filtered
          ? "Elle n’a peut-être pas encore été ajoutée. Une boutique se cherche dans OpenStreetMap, puis s’enregistre ici."
          : "Une boutique arrive avec la première dégustation qu’on y note."}
      </EmptyState>
    );
  }

  return (
    <>
      <div className="border-t border-rule">
        {result.items.map((shop) => (
          <ShopRow key={shop.id} shop={shop} />
        ))}
      </div>
      <Pagination
        pathname="/boutiques"
        query={{ search, city }}
        page={result.page}
        perPage={result.perPage}
        total={result.total}
      />
    </>
  );
}

export default async function ShopsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const search = readText(params.search);
  const city = readText(params.city);
  const page = readPage(params.page);
  const signedIn = (await currentUser()) !== null;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <h1 className="display-serif text-4xl leading-none">Boutiques</h1>
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
          <SearchForm
            action="/boutiques"
            search={search}
            placeholder="Fromagerie Beaufils…"
            label="Chercher une boutique"
          >
            <input
              type="text"
              name="city"
              defaultValue={city ?? ""}
              placeholder="Ville"
              aria-label="Filtrer par ville"
              className="h-10 w-full rounded-card border border-rule bg-white px-3.5 font-mono text-[13px] text-ink outline-none placeholder:text-mute-2 md:w-[140px]"
            />
          </SearchForm>
          {signedIn ? (
            <ButtonLink
              href="/boutiques/nouvelle"
              variant="ghost"
              className="hidden md:inline-flex"
            >
              <PlusIcon />
              Ajouter
            </ButtonLink>
          ) : null}
        </div>
      </div>

      <Suspense key={`${search ?? ""}:${city ?? ""}:${page}`} fallback={<ShopListSkeleton />}>
        <ShopResults search={search} city={city} page={page} />
      </Suspense>
    </div>
  );
}
