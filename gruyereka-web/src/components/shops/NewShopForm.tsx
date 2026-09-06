"use client";

import { useActionState, useState } from "react";
import { addShop } from "@/app/actions/shops";
import { IDLE } from "@/app/actions/state";
import { PlacePicker } from "@/components/shops/PlacePicker";
import { ChoiceChip } from "@/components/ui/ChoiceChip";
import { Notice } from "@/components/ui/Notice";
import { SHOP_KINDS, type ShopKind, shopKindLabels } from "@/lib/vocabulary";

export function NewShopForm() {
  const [state, action, pending] = useActionState(addShop, IDLE);
  const [kind, setKind] = useState<ShopKind>("CHEESEMONGER");

  return (
    <form action={action} className="flex w-full flex-col gap-6 lg:w-[620px]">
      {state.status === "error" ? (
        <Notice title="La boutique n’a pas été créée">{state.message}</Notice>
      ) : null}

      <PlacePicker />

      <fieldset className="flex flex-col gap-2.5">
        <legend className="label-mono pb-1">Le type de boutique</legend>
        <div className="flex flex-wrap gap-2.5">
          {SHOP_KINDS.map((one) => (
            <ChoiceChip
              key={one}
              name="kind"
              value={one}
              type="radio"
              checked={kind === one}
              onChange={() => setKind(one)}
            >
              {shopKindLabels[one]}
            </ChoiceChip>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={pending}
          className="h-11 rounded-card bg-ink px-5 text-sm font-semibold text-paper disabled:opacity-60"
        >
          {pending ? "Un instant…" : "Enregistrer la boutique"}
        </button>
      </div>
    </form>
  );
}
