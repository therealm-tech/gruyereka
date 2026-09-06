import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { TastingRow, type TastingSubject } from "@/components/tastings/TastingRow";
import { ApiFailure } from "@/components/ui/ApiFailure";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PlusIcon } from "@/components/ui/Icon";
import { Pagination } from "@/components/ui/Pagination";
import { getCheese } from "@/lib/api/cheeses";
import { isTransportFailure } from "@/lib/api/errors";
import type { Page as ApiPage, Cheese, Shop, Tasting } from "@/lib/api/schemas";
import { getShop } from "@/lib/api/shops";
import { listTastings } from "@/lib/api/tastings";
import { groupByMonth } from "@/lib/format";
import { currentUser } from "@/lib/session";

const PER_PAGE = 30;

export const metadata: Metadata = {
  title: "Carnet",
  robots: { index: false },
};

function readPage(raw: string | undefined): number {
  const parsed = Number.parseInt(raw ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

async function resolve<T>(ids: readonly string[], get: (id: string) => Promise<T>) {
  const found = new Map<string, T>();
  await Promise.all(
    ids.map(async (id) => {
      try {
        found.set(id, await get(id));
      } catch {
        // A fiche deleted since the entry was written leaves the row readable.
      }
    }),
  );
  return found;
}

export default async function CarnetPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const viewer = await currentUser();
  if (viewer === null) redirect("/connexion");

  const page = readPage((await searchParams).page);

  let result: ApiPage<Tasting>;
  try {
    result = await listTastings({ userId: viewer.id, page, perPage: PER_PAGE });
  } catch (error) {
    if (!isTransportFailure(error)) throw error;
    return <ApiFailure title="Le carnet n’a pas pu être chargé" error={error} />;
  }

  const [cheeses, shops] = await Promise.all([
    resolve<Cheese>(
      [...new Set(result.items.flatMap((one) => one.items.map((item) => item.cheeseId)))],
      getCheese,
    ),
    resolve<Shop>([...new Set(result.items.map((one) => one.shopId))], getShop),
  ]);

  // The carnet is read cheese-first, so the row names them itself; the shop is
  // the other end of the visit and the only thing left to link to.
  const subjectOf = (shop: Shop | undefined): TastingSubject | null =>
    shop === undefined
      ? null
      : { label: shop.name, href: { pathname: `/boutiques/${shop.id}` }, tone: "shop" };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-1.5">
          <h1 className="display-serif text-4xl leading-none">Carnet</h1>
          <p className="font-mono text-xs text-mute">
            {result.total === 0
              ? "Rien de noté pour l’instant"
              : `${result.total} dégustation${result.total > 1 ? "s" : ""} · à vous seul`}
          </p>
        </div>
        <ButtonLink href="/degustations/nouvelle" variant="ghost">
          <PlusIcon />
          Noter une dégustation
        </ButtonLink>
      </div>

      {result.items.length === 0 ? (
        <EmptyState
          title="Le carnet est vide"
          action={
            <ButtonLink href="/degustations/nouvelle">
              <PlusIcon />
              Noter la première
            </ButtonLink>
          }
        >
          Une dégustation garde le jour, la boutique et le prix au kilo. C’est ce qui vous dira,
          dans six mois, où le Comté était le meilleur.
        </EmptyState>
      ) : (
        <>
          <div className="flex flex-col gap-7">
            {groupByMonth(result.items).map((band) => (
              <section key={band.month} className="flex flex-col">
                <h2 className="label-mono pb-1">{band.month}</h2>
                {band.entries.map((tasting) => (
                  <TastingRow
                    key={tasting.id}
                    tasting={tasting}
                    cheeses={cheeses}
                    subject={subjectOf(shops.get(tasting.shopId))}
                    mine={false}
                    editable
                  />
                ))}
              </section>
            ))}
          </div>
          <Pagination
            pathname="/carnet"
            page={result.page}
            perPage={result.perPage}
            total={result.total}
          />
        </>
      )}
    </div>
  );
}
