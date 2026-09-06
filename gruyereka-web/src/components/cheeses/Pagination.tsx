import Link from "next/link";

/**
 * Offset pagination, 1-based, mirroring what the API answers. `total` is the
 * size of the whole filtered set, so the last page is computable here.
 */
export function Pagination({
  page,
  perPage,
  total,
  search,
}: {
  page: number;
  perPage: number;
  total: number;
  search: string | undefined;
}) {
  const lastPage = Math.max(1, Math.ceil(total / perPage));
  const first = total === 0 ? 0 : (page - 1) * perPage + 1;
  const last = Math.min(page * perPage, total);
  const query = (target: number) => ({
    pathname: "/fromages" as const,
    query: search === undefined ? { page: target } : { search, page: target },
  });

  return (
    <nav
      aria-label="Pagination"
      className="mt-1 flex items-center justify-between border-t border-rule pt-4"
    >
      <p className="font-mono text-xs text-mute">
        {total === 0 ? "Aucun résultat" : `${first} – ${last} sur ${total}`}
      </p>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Link
            href={query(page - 1)}
            rel="prev"
            className="flex h-9 items-center rounded-card border border-ink px-3.5 text-[13px] font-semibold text-ink hover:text-ink"
          >
            Précédent
          </Link>
        ) : (
          <span className="flex h-9 items-center rounded-card border border-rule px-3.5 text-[13px] text-mute-2">
            Précédent
          </span>
        )}
        {page < lastPage ? (
          <Link
            href={query(page + 1)}
            rel="next"
            className="flex h-9 items-center rounded-card border border-ink px-3.5 text-[13px] font-semibold text-ink hover:text-ink"
          >
            Suivant
          </Link>
        ) : (
          <span className="flex h-9 items-center rounded-card border border-rule px-3.5 text-[13px] text-mute-2">
            Suivant
          </span>
        )}
      </div>
    </nav>
  );
}
