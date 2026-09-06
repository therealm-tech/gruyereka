"use client";

import { useActionState, useEffect, useState } from "react";
import { IDLE } from "@/app/actions/state";
import { changeRole } from "@/app/actions/users";
import { SpinnerIcon } from "@/components/ui/Icon";
import { USER_ROLES, type UserRole, userRoleLabels } from "@/lib/vocabulary";

/**
 * One form per row, so a refusal lands next to the account it concerns rather
 * than at the top of a list of thirty. Each role is a submit button carrying
 * its own value, which is why this needs no state of its own and works with
 * JavaScript switched off.
 *
 * The prop is `currentRole` rather than `role` because a prop of that name on a
 * JSX element reads as the ARIA attribute, to a linter and to a person alike.
 * The field it submits keeps the wire name.
 */
export function RoleChooser({ userId, currentRole }: { userId: string; currentRole: UserRole }) {
  const [state, action, pending] = useActionState(changeRole, IDLE);
  // `pending` says a role is being applied, not which one. The click records
  // that, so the spinner sits on the button that was pressed instead of on all
  // of them — and it is cleared once the round trip is over, because a refusal
  // leaves the same buttons on screen.
  const [applying, setApplying] = useState<UserRole | null>(null);
  useEffect(() => {
    if (!pending) setApplying(null);
  }, [pending]);

  return (
    <form
      action={action}
      aria-busy={pending}
      className="flex flex-col items-start gap-1.5 md:items-end"
    >
      <input type="hidden" name="userId" value={userId} />
      <div className="flex flex-wrap gap-1.5">
        {USER_ROLES.map((one) =>
          one === currentRole ? (
            <span
              key={one}
              aria-current="true"
              className="flex h-8 items-center rounded-full bg-ink px-3 text-[13px] font-medium text-paper"
            >
              {userRoleLabels[one]}
            </span>
          ) : (
            <button
              key={one}
              type="submit"
              name="role"
              value={one}
              disabled={pending}
              onClick={() => setApplying(one)}
              className="flex h-8 items-center gap-1.5 rounded-full border border-rule px-3 text-[13px] text-ink-2 disabled:opacity-60"
            >
              {pending && applying === one ? <SpinnerIcon /> : null}
              {userRoleLabels[one]}
            </button>
          ),
        )}
      </div>
      {state.status === "error" ? (
        <p className="text-[13px] text-refusal">{state.message}</p>
      ) : null}
    </form>
  );
}
