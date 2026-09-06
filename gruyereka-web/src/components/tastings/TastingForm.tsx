"use client";

import { useActionState, useState } from "react";
import type { Option } from "@/app/actions/pick";
import { IDLE } from "@/app/actions/state";
import { addTasting, editTasting } from "@/app/actions/tastings";
import { ChoiceChip } from "@/components/ui/ChoiceChip";
import { EntityPicker } from "@/components/ui/EntityPicker";
import { PlusIcon } from "@/components/ui/Icon";
import { Notice } from "@/components/ui/Notice";
import {
  CURRENCIES,
  type Currency,
  currencyLabels,
  RATING_LEVELS,
  type RatingLevel,
  ratingLabels,
} from "@/lib/vocabulary";

/** One cheese of the basket, as the form holds it before anything is posted. */
export type BasketRow = {
  cheese: Option | null;
  rating: RatingLevel | null;
  price: string;
  comment: string;
};

/**
 * Deliberately not exported: a plain function cannot cross the client boundary,
 * and a server page reaching for it fails at request time rather than at build
 * time. A page that needs a blank row writes the literal itself.
 */
function emptyRow(): BasketRow {
  return { cheese: null, rating: null, price: "", comment: "" };
}

/** Stable across a removal, unlike the position the field names are built from. */
let nextKey = 0;
function keyed(rows: BasketRow[]): { key: number; row: BasketRow }[] {
  return rows.map((row) => ({ key: nextKey++, row }));
}

/**
 * A visit is one shop on one day, and one line per cheese brought home from it.
 * The rating, the price and the notes hang off the line rather than the visit,
 * which is what keeps a cheese's average its own.
 *
 * The field names carry the row's position — `items.0.rating` — because a rating
 * is a radio group, and a name shared across rows would make one group of the
 * whole basket. React keys stay independent of that position, so removing a row
 * renumbers the names without disturbing what the surviving rows hold.
 */
export function TastingForm({
  tastingId,
  shop,
  initialRows,
  currency: initialCurrency,
  today,
  tastedOn,
  findCheeses,
  findShops,
}: {
  /** Absent when the visit is being recorded rather than corrected. */
  tastingId?: string | undefined;
  shop: Option | null;
  initialRows: BasketRow[];
  currency: Currency;
  today: string;
  tastedOn: string;
  findCheeses: (query: string) => Promise<Option[]>;
  findShops: (query: string) => Promise<Option[]>;
}) {
  const editing = tastingId !== undefined;
  const [state, action, pending] = useActionState(editing ? editTasting : addTasting, IDLE);
  const [rows, setRows] = useState(() => keyed(initialRows));
  const [currency, setCurrency] = useState<Currency>(initialCurrency);

  const fields = state.status === "error" ? state.fields : undefined;

  const setRating = (key: number, rating: RatingLevel) =>
    setRows((current) =>
      current.map((entry) =>
        entry.key === key ? { ...entry, row: { ...entry.row, rating } } : entry,
      ),
    );

  return (
    <form action={action} className="flex w-full flex-col gap-6 lg:w-[680px]">
      {state.status === "error" ? (
        <Notice
          title={editing ? "La correction n’est pas passée" : "La dégustation n’a pas été notée"}
        >
          {state.message}
        </Notice>
      ) : null}

      {editing ? <input type="hidden" name="tastingId" value={tastingId} /> : null}

      {editing ? (
        <dl className="flex flex-col gap-0.5 rounded-card border border-rule bg-paper-2 p-4">
          <dt className="label-mono">La boutique</dt>
          <dd className="text-[15px] font-semibold">{shop?.label ?? "Fiche retirée"}</dd>
        </dl>
      ) : (
        <EntityPicker
          name="shopId"
          legend="La boutique"
          placeholder="Fromagerie Beaufils…"
          search={findShops}
          initial={shop}
          missing="Aucune boutique sous ce nom. Ajoutez-la avant de noter ici."
        />
      )}

      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-2">
          <label htmlFor="tasting-day" className="label-mono">
            Le jour
          </label>
          <input
            id="tasting-day"
            name="tastedOn"
            type="date"
            max={today}
            defaultValue={tastedOn}
            className="h-11 rounded-card border border-rule bg-white px-3.5 font-mono text-base outline-none focus:border-ink"
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="tasting-currency" className="label-mono">
            Monnaie
          </label>
          <select
            id="tasting-currency"
            name="currency"
            value={currency}
            onChange={(event) => setCurrency(event.target.value as Currency)}
            className="h-11 rounded-card border border-rule bg-white px-3 text-sm outline-none focus:border-ink"
          >
            {CURRENCIES.map((code) => (
              <option key={code} value={code}>
                {currencyLabels[code]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <h2 className="label-mono">Les fromages</h2>

        {rows.map(({ key, row }, index) => {
          const priceError = fields?.[`items.${index}.pricePerKg`];
          return (
            <fieldset
              key={key}
              className="flex flex-col gap-4 rounded-card border border-rule bg-white p-4"
            >
              <legend className="sr-only">Fromage {index + 1}</legend>

              <div className="flex items-start justify-between gap-3">
                <span className="font-mono text-[11px] text-mute-2">#{index + 1}</span>
                {rows.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => setRows((current) => current.filter((one) => one.key !== key))}
                    className="text-[13px] font-semibold text-link"
                  >
                    Retirer
                  </button>
                ) : null}
              </div>

              <EntityPicker
                name={`items.${index}.cheeseId`}
                legend="Le fromage"
                placeholder="Comté, Ossau-Iraty…"
                search={findCheeses}
                initial={row.cheese}
                missing="Aucun fromage sous ce nom. Créez sa fiche avant de le noter."
              />

              <div className="flex flex-col gap-2.5">
                <span className="label-mono">Ce que vous en avez pensé</span>
                <div className="flex flex-wrap gap-2.5">
                  {RATING_LEVELS.map((level) => (
                    <ChoiceChip
                      key={level}
                      name={`items.${index}.rating`}
                      value={level}
                      type="radio"
                      checked={row.rating === level}
                      onChange={() => setRating(key, level)}
                    >
                      {ratingLabels[level]}
                    </ChoiceChip>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-end gap-4">
                <div className="flex flex-col gap-2">
                  <label htmlFor={`price-${key}`} className="label-mono">
                    Prix au kilo — facultatif
                  </label>
                  <input
                    id={`price-${key}`}
                    name={`items.${index}.pricePerKg`}
                    inputMode="decimal"
                    defaultValue={row.price}
                    placeholder="32,50"
                    aria-invalid={priceError !== undefined}
                    className={`h-11 w-32 rounded-card border bg-white px-3.5 font-mono text-base outline-none ${
                      priceError === undefined ? "border-rule focus:border-ink" : "border-refusal"
                    }`}
                  />
                  {priceError === undefined ? null : (
                    <p className="text-xs text-refusal">{priceError}</p>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor={`comment-${key}`} className="label-mono">
                  Vos notes — facultatif
                </label>
                <textarea
                  id={`comment-${key}`}
                  name={`items.${index}.comment`}
                  rows={2}
                  maxLength={2000}
                  defaultValue={row.comment}
                  placeholder="Le goût, la texture, ce qui allait avec…"
                  className="rounded-card border border-rule bg-white p-3 text-sm leading-relaxed outline-none focus:border-ink"
                />
              </div>
            </fieldset>
          );
        })}

        <button
          type="button"
          onClick={() => setRows((current) => [...current, ...keyed([emptyRow()])])}
          className="flex h-10 w-fit items-center gap-2 rounded-card border border-ink px-4 text-sm font-semibold"
        >
          <PlusIcon />
          Ajouter un fromage
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={pending}
          className="h-11 rounded-card bg-ink px-5 text-sm font-semibold text-paper disabled:opacity-60"
        >
          {pending ? "Un instant…" : editing ? "Enregistrer la correction" : "Noter la dégustation"}
        </button>
      </div>
    </form>
  );
}
