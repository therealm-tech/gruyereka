"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

/**
 * The last net. Next hands the digest of what was thrown on the server; the
 * message itself never crosses, which is what we want.
 */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The server already logged the cause; this records that a viewer saw it.
    const digest = error.digest ?? "none";
    document.title = `Erreur · Gruyereka (${digest})`;
  }, [error.digest]);

  return (
    <div className="flex min-h-dvh items-center justify-center px-5">
      <EmptyState
        faded
        title="Le serveur n’a rien dit"
        action={<Button onClick={reset}>Réessayer</Button>}
      >
        Rien n’a été perdu. Réessayez dans un instant.
      </EmptyState>
    </div>
  );
}
