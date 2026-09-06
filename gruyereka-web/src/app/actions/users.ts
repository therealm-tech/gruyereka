"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { FormState } from "@/app/actions/state";
import { ApiError, ApiUnreachableError, sentenceFor } from "@/lib/api/errors";
import { setUserRole } from "@/lib/api/users";
import { logger } from "@/lib/logger";
import { sessionToken } from "@/lib/session";
import { USER_ROLES } from "@/lib/vocabulary";

const move = z.object({
  userId: z.uuid(),
  role: z.enum(USER_ROLES, { message: "Ce rôle n’existe pas." }),
});

export async function changeRole(_previous: FormState, formData: FormData): Promise<FormState> {
  const token = await sessionToken();
  if (token === null) {
    return { status: "error", message: "Connectez-vous pour changer un rôle." };
  }

  const parsed = move.safeParse({
    userId: formData.get("userId"),
    role: formData.get("role"),
  });
  if (!parsed.success) {
    return { status: "error", message: "Ce changement de rôle n’a pas été compris." };
  }

  try {
    await setUserRole(parsed.data.userId, parsed.data.role, token);
    logger.info("user.roleChanged", { userId: parsed.data.userId, role: parsed.data.role });
  } catch (error) {
    if (error instanceof ApiError && error.code === "FORBIDDEN") {
      // The one case the API refuses to an administrator: their own row. The
      // page does not draw the buttons for it, so this is a second tab or a
      // hand-written post.
      return {
        status: "error",
        message: "Un administrateur ne change pas son propre rôle.",
      };
    }
    if (error instanceof ApiError && error.code === "NOT_FOUND") {
      return { status: "error", message: "Ce compte n’existe plus." };
    }
    if (error instanceof ApiError || error instanceof ApiUnreachableError) {
      return { status: "error", message: sentenceFor(error) };
    }
    throw error;
  }

  // The listing is fetched with a bearer and never cached, so only the rendered
  // page needs discarding.
  revalidatePath("/administration");
  return { status: "idle" };
}
