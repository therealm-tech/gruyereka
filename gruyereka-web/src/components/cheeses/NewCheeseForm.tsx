"use client";

import { useActionState, useState } from "react";
import { addCheese } from "@/app/actions/cheeses";
import { IDLE } from "@/app/actions/state";
import { ChoiceChip } from "@/components/ui/ChoiceChip";
import { Notice } from "@/components/ui/Notice";
import {
  MILK_TYPES,
  type MilkType,
  milkLabels,
  PASTE_TYPES,
  type PasteType,
  PROTECTED_DESIGNATIONS,
  type ProtectedDesignation,
  pasteLabels,
} from "@/lib/vocabulary";

export function NewCheeseForm() {
  const [state, action, pending] = useActionState(addCheese, IDLE);
  const [milkTypes, setMilkTypes] = useState<MilkType[]>([]);
  const [pasteType, setPasteType] = useState<PasteType>("PRESSED_UNCOOKED");
  const [designation, setDesignation] = useState<ProtectedDesignation | null>(null);
  const [agingMonths, setAgingMonths] = useState<number | null>(null);

  const fields = state.status === "error" ? state.fields : undefined;

  const toggleMilk = (milk: MilkType) =>
    setMilkTypes((current) =>
      current.includes(milk) ? current.filter((item) => item !== milk) : [...current, milk],
    );

  return (
    <form action={action} className="flex w-full flex-col gap-5 lg:w-[620px]">
      {state.status === "error" ? (
        <Notice title="Le fromage n’a pas été créé">{state.message}</Notice>
      ) : null}

      <div className="flex flex-col gap-2">
        <label htmlFor="cheese-name" className="label-mono">
          Nom
        </label>
        <input
          id="cheese-name"
          name="name"
          autoComplete="off"
          aria-invalid={fields?.name !== undefined}
          className={`h-11 rounded-card border bg-white px-3.5 text-base outline-none ${
            fields?.name === undefined ? "border-rule focus:border-ink" : "border-refusal"
          }`}
        />
        {fields?.name === undefined ? null : <p className="text-xs text-refusal">{fields.name}</p>}
      </div>

      <fieldset className="flex flex-col gap-2.5">
        <legend className="label-mono pb-1">Lait — un ou plusieurs</legend>
        <div className="flex flex-wrap gap-2.5">
          {MILK_TYPES.map((milk) => (
            <ChoiceChip
              key={milk}
              name="milkTypes"
              value={milk}
              type="checkbox"
              checked={milkTypes.includes(milk)}
              onChange={() => toggleMilk(milk)}
            >
              {milkLabels[milk]}
            </ChoiceChip>
          ))}
        </div>
        {fields?.milkTypes === undefined ? null : (
          <p className="text-xs text-refusal">{fields.milkTypes}</p>
        )}
      </fieldset>

      <div className="flex flex-col gap-2">
        <label htmlFor="cheese-paste" className="label-mono">
          Pâte
        </label>
        <select
          id="cheese-paste"
          name="pasteType"
          value={pasteType}
          onChange={(event) => setPasteType(event.target.value as PasteType)}
          className="h-11 rounded-card border border-rule bg-white px-3 text-base outline-none focus:border-ink"
        >
          {PASTE_TYPES.map((paste) => (
            <option key={paste} value={paste}>
              {pasteLabels[paste]}
            </option>
          ))}
        </select>
      </div>

      <fieldset className="flex flex-col gap-2.5">
        <legend className="label-mono pb-1">Signe de qualité — facultatif</legend>
        <div className="flex flex-wrap gap-2.5">
          {PROTECTED_DESIGNATIONS.map((sign) => (
            <ChoiceChip
              key={sign}
              name="designation"
              value={sign}
              type="radio"
              checked={designation === sign}
              onChange={() => setDesignation(sign)}
            >
              {sign}
            </ChoiceChip>
          ))}
          <ChoiceChip
            name="designation"
            value=""
            type="radio"
            checked={designation === null}
            onChange={() => setDesignation(null)}
          >
            Aucun
          </ChoiceChip>
        </div>
      </fieldset>

      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-2">
          <label htmlFor="cheese-aging" className="label-mono">
            Affinage en mois — facultatif
          </label>
          <input
            id="cheese-aging"
            name="agingMonths"
            type="number"
            inputMode="numeric"
            min={0}
            max={600}
            value={agingMonths ?? ""}
            onChange={(event) =>
              setAgingMonths(event.target.value === "" ? null : Number(event.target.value))
            }
            className="h-11 w-40 rounded-card border border-rule bg-white px-3.5 font-mono text-base outline-none focus:border-ink"
          />
        </div>
        <button
          type="button"
          onClick={() => setAgingMonths(null)}
          className="h-11 rounded-card border border-rule px-4 text-sm text-ink-2"
        >
          Non précisé
        </button>
      </div>

      <div className="flex flex-wrap gap-3 pt-1">
        <button
          type="submit"
          disabled={pending}
          className="h-11 rounded-card bg-ink px-5 text-sm font-semibold text-paper disabled:opacity-60"
        >
          {pending ? "Un instant…" : "Créer le fromage"}
        </button>
      </div>
    </form>
  );
}
