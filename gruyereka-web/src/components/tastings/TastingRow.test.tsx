import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TastingRow, type TastingSubject } from "@/components/tastings/TastingRow";
import type { Tasting } from "@/lib/api/schemas";

const BASE: Tasting = {
  id: "0199a1f0-0000-7000-8000-000000000020",
  userId: "0199a1f0-0000-7000-8000-000000000002",
  cheeseId: "0199a1f0-0000-7000-8000-000000000001",
  shopId: "0199a1f0-0000-7000-8000-000000000010",
  rating: "DELICIOUS",
  pricePerKg: { amountCents: 3250, currency: "EUR" },
  comment: "Bien fruité, une pointe de cristaux.",
  tastedOn: "2026-08-30",
  createdAt: "2026-08-30T10:00:00Z",
  updatedAt: "2026-08-30T10:00:00Z",
};

const SHOP: TastingSubject = {
  label: "Fromagerie Beaufils",
  href: { pathname: "/boutiques/0199a1f0-0000-7000-8000-000000000010" },
  tone: "shop",
};

describe("TastingRow", () => {
  it("carries the day and the price, which is what makes it a log entry", () => {
    render(<TastingRow tasting={BASE} subject={SHOP} mine={false} />);
    expect(screen.getByText("30.08.2026")).toBeInTheDocument();
    expect(screen.getByText("32,50 €/kg")).toBeInTheDocument();
  });

  it("links to the other end of the tasting", () => {
    render(<TastingRow tasting={BASE} subject={SHOP} mine={false} />);
    expect(screen.getByRole("link", { name: "Fromagerie Beaufils" })).toHaveAttribute(
      "href",
      "/boutiques/0199a1f0-0000-7000-8000-000000000010",
    );
  });

  it("still reads when the fiche it pointed at is gone", () => {
    render(<TastingRow tasting={BASE} subject={null} mine={false} />);
    expect(screen.getByText("Fiche retirée")).toBeInTheDocument();
    expect(screen.getByText("Délicieux")).toBeInTheDocument();
  });

  it("offers a correction only where one is allowed", () => {
    const { rerender } = render(<TastingRow tasting={BASE} subject={SHOP} mine />);
    expect(screen.queryByRole("link", { name: "Corriger" })).not.toBeInTheDocument();

    rerender(<TastingRow tasting={BASE} subject={SHOP} mine editable />);
    expect(screen.getByRole("link", { name: "Corriger" })).toHaveAttribute(
      "href",
      `/degustations/${BASE.id}/modifier`,
    );
  });

  it("says nothing about a price that was never noted", () => {
    render(<TastingRow tasting={{ ...BASE, pricePerKg: null }} subject={SHOP} mine={false} />);
    expect(screen.queryByText(/€\/kg/)).not.toBeInTheDocument();
  });

  it("reads the level as a word, never as a code", () => {
    render(<TastingRow tasting={{ ...BASE, rating: "MEH" }} subject={SHOP} mine={false} />);
    expect(screen.getByText("Bof")).toBeInTheDocument();
    expect(screen.queryByText(/MEH/)).not.toBeInTheDocument();
  });
});
