import type { Route } from "next";
import Link from "next/link";

/**
 * Offset pagination, 1-based, mirroring what the API answers. `total` is the
 * size of the whole filtered set, so the last page is computable here.
 *
 * The filters in force travel in `query` so that paging keeps them, and so a
 * page-two URL says what it is showing.
 */
export function Pagination({
  pathname,
  query = {},
  page,
  perPage,
  total,
}: {
  pathname: Route;
  query?: Readonly<Record<string, string | undefined>>;
  page: number;
  perPage: number;
  total: number;
}) {
  const lastPage = Math.max(1, Math.ceil(total / perPage));
  const first = total === 0 ? 0 : (page - 1) * perPage + 1;
  const last = Math.min(page * perPage, total);

  const href = (target: number) => {
    const carried: Record<string, string> = {};
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) carried[key] = value;
    }
    return { pathname, query: { ...carried, page: String(target) } };
  };

  const step = (target: number, rel: "prev" | "next", label: string) => (
    <Link
      href={href(target)}
      rel={rel}
      className="flex h-9 items-center rounded-card border border-ink px-3.5 text-[13px] font-semibold text-ink"
    >
      {label}
    </Link>
  );

  const spent = (label: string) => (
    <span className="flex h-9 items-center rounded-card border border-rule px-3.5 text-[13px] text-mute-2">
      {label}
    </span>
  );

  return (
    <nav
      aria-label="Pagination"
      className="mt-1 flex items-center justify-between border-t border-rule pt-4"
    >
      <p className="font-mono text-xs text-mute">
        {total === 0 ? "Aucun résultat" : `${first} – ${last} sur ${total}`}
      </p>
      <div className="flex items-center gap-2">
        {page > 1 ? step(page - 1, "prev", "Précédent") : spent("Précédent")}
        {page < lastPage ? step(page + 1, "next", "Suivant") : spent("Suivant")}
      </div>
    </nav>
  );
}
