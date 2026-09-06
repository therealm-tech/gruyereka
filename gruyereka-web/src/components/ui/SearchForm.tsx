import type { Route } from "next";
import type { ReactNode } from "react";
import { SearchIcon } from "@/components/ui/Icon";

/**
 * A plain GET form: the query lands in the URL, the page is server-rendered
 * from it, and searching works with JavaScript switched off. It is also what
 * makes a result page shareable and indexable.
 *
 * `children` is where a listing puts its own extra filters — they are inputs of
 * this form, so they submit with the search term instead of clearing it.
 */
export function SearchForm({
  action,
  search,
  placeholder,
  label,
  children,
}: {
  action: Route;
  search: string | undefined;
  placeholder: string;
  label: string;
  children?: ReactNode;
}) {
  return (
    <search className="w-full md:w-auto">
      <form action={action} method="get" className="flex w-full flex-wrap gap-2 md:w-auto">
        <div className="flex h-10 w-full items-center gap-2.5 rounded-card border border-rule bg-white px-3.5 md:w-[300px]">
          <SearchIcon className="shrink-0 text-mute" />
          <input
            type="search"
            name="search"
            defaultValue={search ?? ""}
            placeholder={placeholder}
            aria-label={label}
            className="w-full bg-transparent font-mono text-[13px] text-ink outline-none placeholder:text-mute-2"
          />
        </div>
        {children}
        <button
          type="submit"
          className="h-10 shrink-0 rounded-card border border-ink px-4 text-sm font-semibold md:sr-only md:h-0 md:border-0 md:p-0"
        >
          Chercher
        </button>
      </form>
    </search>
  );
}
