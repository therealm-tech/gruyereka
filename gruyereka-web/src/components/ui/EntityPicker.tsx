"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { Option } from "@/app/actions/pick";
import { CheckIcon, SearchIcon } from "@/components/ui/Icon";

const DEBOUNCE_MS = 250;

/**
 * Picks one existing row by name and submits its id. Both lookups it serves hit
 * this app's own API, so unlike the OpenStreetMap search it can afford to fire
 * as you type.
 *
 * A cheese or a shop that is not in the list has to be created first: a tasting
 * points at rows that exist, and inventing one here would put two half-filled
 * forms on one page.
 */
export function EntityPicker({
  name,
  legend,
  placeholder,
  search,
  initial,
  missing,
}: {
  name: string;
  legend: string;
  placeholder: string;
  search: (query: string) => Promise<Option[]>;
  initial: Option | null;
  missing: string;
}) {
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<Option[] | null>(null);
  const [chosen, setChosen] = useState<Option | null>(initial);
  const [pending, startSearch] = useTransition();
  const latest = useRef(0);

  useEffect(() => {
    if (query.trim().length < 2) {
      setOptions(null);
      return;
    }
    const timer = setTimeout(() => {
      // Answers can land out of order; only the newest query may paint.
      const mine = latest.current + 1;
      latest.current = mine;
      startSearch(async () => {
        const found = await search(query);
        if (latest.current === mine) setOptions(found);
      });
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, search]);

  return (
    <fieldset className="flex flex-col gap-2.5">
      <legend className="label-mono pb-1">{legend}</legend>
      <input type="hidden" name={name} value={chosen?.id ?? ""} />

      {chosen === null ? null : (
        <div className="flex items-center justify-between gap-3 rounded-card border border-ink bg-cream px-3.5 py-2.5">
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-[15px] font-semibold">{chosen.label}</span>
            <span className="truncate font-mono text-[11px] text-ink-2">{chosen.hint}</span>
          </span>
          <button
            type="button"
            onClick={() => setChosen(null)}
            className="shrink-0 text-[13px] font-semibold text-link"
          >
            Changer
          </button>
        </div>
      )}

      {chosen === null ? (
        <>
          <div className="flex h-11 items-center gap-2.5 rounded-card border border-rule bg-white px-3.5">
            <SearchIcon className="shrink-0 text-mute" />
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                // Enter in a search box must not post a half-filled tasting.
                if (event.key === "Enter") event.preventDefault();
              }}
              placeholder={placeholder}
              aria-label={legend}
              className="w-full bg-transparent text-base text-ink outline-none placeholder:text-mute-2"
            />
            {pending ? <span className="shrink-0 font-mono text-[11px] text-mute">…</span> : null}
          </div>

          {options !== null && options.length === 0 ? (
            <p className="rounded-card border border-dashed border-rule-strong px-4 py-4 text-center text-[13px] text-ink-2 text-pretty">
              {missing}
            </p>
          ) : null}

          {options !== null && options.length > 0 ? (
            <ul className="flex flex-col overflow-hidden rounded-card border border-rule bg-white">
              {options.map((option) => (
                <li key={option.id} className="border-b border-rule last:border-b-0">
                  <button
                    type="button"
                    onClick={() => setChosen(option)}
                    className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left"
                  >
                    <span className="flex min-w-0 grow flex-col gap-0.5">
                      <span className="truncate text-[15px] font-semibold">{option.label}</span>
                      <span className="truncate font-mono text-[11px] text-mute">
                        {option.hint}
                      </span>
                    </span>
                    <CheckIcon className="shrink-0 text-mute-3" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : null}
    </fieldset>
  );
}
