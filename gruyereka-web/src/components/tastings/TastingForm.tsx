"use client";

import { useActionState, useState } from "react";
import type { Option } from "@/app/actions/pick";
import { IDLE } from "@/app/actions/state";
import { addTasting, editTasting } from "@/app/actions/tastings";
import { ChoiceChip } from "@/components/ui/ChoiceChip";
import { EntityPicker } from "@/components/ui/EntityPicker";
import { Notice } from "@/components/ui/Notice";
import type { Tasting } from "@/lib/api/schemas";
import {
  CURRENCIES,
  type Currency,
  currencyLabels,
  RATING_LEVELS,
  type RatingLevel,
  ratingLabels,
} from "@/lib/vocabulary";

function amountOf(tasting: Tasting | null): string {
  if (tasting?.pricePerKg == null) return "";
  return (tasting.pricePerKg.amountCents / 100).toFixed(2).replace(".", ",");
}

function isCurrency(code: string): code is Currency {
  return (CURRENCIES as readonly string[]).includes(code);
}

/**
 * The same fields whether the entry is new or being corrected. What changes is
 * the top: a tasting's cheese and shop are fixed at creation, so a correction
 * shows them rather than offering to move them — the API has no way to.
 */
export function TastingForm({
  existing,
  cheese,
  shop,
  today,
  findCheeses,
  findShops,
}: {
  existing: Tasting | null;
  cheese: Option | null;
  shop: Option | null;
  today: string;
  findCheeses: (query: string) => Promise<Option[]>;
  findShops: (query: string) => Promise<Option[]>;
}) {
  const editing = existing !== null;
  const [state, action, pending] = useActionState(editing ? editTasting : addTasting, IDLE);
  const [rating, setRating] = useState<RatingLevel | null>(existing?.rating ?? null);
  const [currency, setCurrency] = useState<Currency>(() => {
    const code = existing?.pricePerKg?.currency ?? "EUR";
    return isCurrency(code) ? code : "EUR";
  });

  const fields = state.status === "error" ? state.fields : undefined;

  return (
    <form action={action} className="flex w-full flex-col gap-6 lg:w-[620px]">
      {state.status === "error" ? (
        <Notice
          title={editing ? "La correction n’est pas passée" : "La dégustation n’a pas été notée"}
        >
          {state.message}
        </Notice>
      ) : null}

      {editing ? (
        <>
          <input type="hidden" name="tastingId" value={existing.id} />
          <input type="hidden" name="cheeseId" value={existing.cheeseId} />
          <dl className="flex flex-col gap-3 rounded-card border border-rule bg-paper-2 p-4">
            <div className="flex flex-col gap-0.5">
              <dt className="label-mono">Le fromage</dt>
              <dd className="text-[15px] font-semibold">{cheese?.label ?? "Fiche retirée"}</dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="label-mono">La boutique</dt>
              <dd className="text-[15px] font-semibold">{shop?.label ?? "Fiche retirée"}</dd>
            </div>
          </dl>
        </>
      ) : (
        <>
          <EntityPicker
            name="cheeseId"
            legend="Le fromage"
            placeholder="Comté, Ossau-Iraty…"
            search={findCheeses}
            initial={cheese}
            missing="Aucun fromage sous ce nom. Créez sa fiche avant de le noter."
          />
          <EntityPicker
            name="shopId"
            legend="La boutique"
            placeholder="Fromagerie Beaufils…"
            search={findShops}
            initial={shop}
            missing="Aucune boutique sous ce nom. Ajoutez-la avant de noter ici."
          />
        </>
      )}

      <fieldset className="flex flex-col gap-2.5">
        <legend className="label-mono pb-1">Ce que vous en avez pensé</legend>
        <div className="flex flex-wrap gap-2.5">
          {RATING_LEVELS.map((level) => (
            <ChoiceChip
              key={level}
              name="rating"
              value={level}
              type="radio"
              checked={rating === level}
              onChange={() => setRating(level)}
            >
              {ratingLabels[level]}
            </ChoiceChip>
          ))}
        </div>
      </fieldset>

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
            defaultValue={existing?.tastedOn ?? today}
            className="h-11 rounded-card border border-rule bg-white px-3.5 font-mono text-base outline-none focus:border-ink"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="tasting-price" className="label-mono">
            Prix au kilo — facultatif
          </label>
          <div className="flex gap-2">
            <input
              id="tasting-price"
              name="pricePerKg"
              inputMode="decimal"
              defaultValue={amountOf(existing)}
              placeholder="32,50"
              aria-invalid={fields?.pricePerKg !== undefined}
              className={`h-11 w-32 rounded-card border bg-white px-3.5 font-mono text-base outline-none ${
                fields?.pricePerKg === undefined ? "border-rule focus:border-ink" : "border-refusal"
              }`}
            />
            <select
              name="currency"
              value={currency}
              onChange={(event) => setCurrency(event.target.value as Currency)}
              aria-label="Monnaie"
              className="h-11 rounded-card border border-rule bg-white px-3 text-sm outline-none focus:border-ink"
            >
              {CURRENCIES.map((code) => (
                <option key={code} value={code}>
                  {currencyLabels[code]}
                </option>
              ))}
            </select>
          </div>
          {fields?.pricePerKg === undefined ? null : (
            <p className="text-xs text-refusal">{fields.pricePerKg}</p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="tasting-comment" className="label-mono">
          Vos notes — facultatif
        </label>
        <textarea
          id="tasting-comment"
          name="comment"
          rows={4}
          maxLength={2000}
          defaultValue={existing?.comment ?? ""}
          placeholder="Le goût, la texture, ce qui allait avec…"
          className="rounded-card border border-rule bg-white p-3 text-sm leading-relaxed outline-none focus:border-ink"
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={pending || rating === null}
          className="h-11 rounded-card bg-ink px-5 text-sm font-semibold text-paper disabled:opacity-60"
        >
          {pending ? "Un instant…" : editing ? "Enregistrer la correction" : "Noter la dégustation"}
        </button>
      </div>
    </form>
  );
}
