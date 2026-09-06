import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh items-center justify-center px-5">
      <EmptyState
        faded
        title="Cette page n’existe plus"
        action={<ButtonLink href="/fromages">Retour aux fromages</ButtonLink>}
      >
        Un modérateur l’a retirée, ou le lien a vieilli.
      </EmptyState>
    </div>
  );
}
