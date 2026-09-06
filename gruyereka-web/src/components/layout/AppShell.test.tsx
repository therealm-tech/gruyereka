import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AppShell } from "@/components/layout/AppShell";
import type { User } from "@/lib/api/schemas";

vi.mock("next/navigation", () => ({ usePathname: () => "/fromages" }));

const CAMILLE: User = {
  id: "0199a1f0-0000-7000-8000-000000000001",
  email: "camille@example.org",
  displayName: "Camille Dupont",
  role: "USER",
  createdAt: "2026-08-30T10:00:00Z",
  updatedAt: "2026-08-30T10:00:00Z",
};

describe("AppShell", () => {
  it("offers no way to add a cheese to somebody who cannot", () => {
    render(
      <AppShell user={null}>
        <p>contenu</p>
      </AppShell>,
    );

    expect(screen.queryByRole("link", { name: /ajouter un fromage/i })).not.toBeInTheDocument();
    // The rail and the mobile header both render; CSS decides which one shows,
    // and jsdom applies none of it.
    const signIn = screen.getAllByRole("link", { name: "Se connecter" });
    expect(signIn.length).toBeGreaterThan(0);
    for (const link of signIn) expect(link).toHaveAttribute("href", "/connexion");
  });

  it("offers it once signed in", () => {
    render(
      <AppShell user={CAMILLE}>
        <p>contenu</p>
      </AppShell>,
    );

    expect(screen.getByRole("link", { name: /ajouter un fromage/i })).toHaveAttribute(
      "href",
      "/fromages/nouveau",
    );
    expect(screen.queryAllByRole("link", { name: "Se connecter" })).toHaveLength(0);
  });

  it("names the signed-in account and its role in French", () => {
    render(
      <AppShell user={{ ...CAMILLE, role: "MODERATOR" }}>
        <p>contenu</p>
      </AppShell>,
    );

    expect(screen.getAllByText("Camille Dupont").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Modérateur").length).toBeGreaterThan(0);
    expect(screen.queryByText("MODERATOR")).not.toBeInTheDocument();
  });
});
