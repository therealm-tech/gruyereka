"use client";

import { useActionState, useState } from "react";
import { reviewShop } from "@/app/actions/shops";
import { IDLE } from "@/app/actions/state";
import { Notice } from "@/components/ui/Notice";
import type { ShopReview } from "@/lib/api/schemas";

const SCORES = [1, 2, 3, 4, 5] as const;

/**
 * One review per person and per shop, so this form is the same whether it is a
 * first opinion or a correction: sending it rewrites whatever was there.
 */
export function ShopReviewForm({ shopId, mine }: { shopId: string; mine: ShopReview | null }) {
  const [state, action, pending] = useActionState(reviewShop, IDLE);
  const [score, setScore] = useState<number>(mine?.score ?? 0);

  return (
    <form
      action={action}
      className="flex flex-col gap-4 rounded-card border border-rule bg-white p-5"
    >
      <h2 className="label-mono">{mine === null ? "Votre avis" : "Votre avis, à corriger"}</h2>

      {state.status === "error" ? (
        <Notice title="L’avis n’a pas été enregistré">{state.message}</Notice>
      ) : null}

      <input type="hidden" name="shopId" value={shopId} />

      <fieldset className="flex flex-col gap-2">
        <legend className="sr-only">Note sur cinq</legend>
        <div className="flex items-center gap-1.5">
          {SCORES.map((step) => (
            <label
              key={step}
              className="cursor-pointer p-0.5"
              aria-label={`${step} sur 5`}
              title={`${step} sur 5`}
            >
              <input
                type="radio"
                name="score"
                value={step}
                checked={score === step}
                onChange={() => setScore(step)}
                className="sr-only"
              />
              <svg width="22" height="22" viewBox="0 0 12 12" aria-hidden="true">
                {step <= score ? (
                  <circle cx="6" cy="6" r="5" fill="var(--color-pine)" />
                ) : (
                  <circle
                    cx="6"
                    cy="6"
                    r="4.2"
                    fill="none"
                    stroke="var(--color-rule-strong)"
                    strokeWidth="1.6"
                  />
                )}
              </svg>
            </label>
          ))}
          <span className="pl-2 font-mono text-xs text-mute">
            {score === 0 ? "Pas encore noté" : `${score} sur 5`}
          </span>
        </div>
      </fieldset>

      <div className="flex flex-col gap-2">
        <label htmlFor="review-comment" className="label-mono">
          Un mot — facultatif
        </label>
        <textarea
          id="review-comment"
          name="comment"
          rows={3}
          defaultValue={mine?.comment ?? ""}
          maxLength={2000}
          placeholder="L’accueil, le choix, l’affinage…"
          className="rounded-card border border-rule bg-white p-3 text-sm leading-relaxed outline-none focus:border-ink"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending || score === 0}
          className="h-10 rounded-card bg-ink px-5 text-sm font-semibold text-paper disabled:opacity-60"
        >
          {pending ? "Un instant…" : mine === null ? "Publier l’avis" : "Corriger l’avis"}
        </button>
        {score === 0 ? (
          <span className="text-[13px] text-mute">Mettez une note d’abord.</span>
        ) : null}
      </div>
    </form>
  );
}
