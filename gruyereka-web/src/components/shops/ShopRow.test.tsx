import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ShopRow } from "@/components/shops/ShopRow";
import type { Shop } from "@/lib/api/schemas";

const BASE: Shop = {
  id: "0199a1f0-0000-7000-8000-000000000010",
  name: "Fromagerie Beaufils",
  kind: "CHEESEMONGER",
  osm: { element: "NODE", id: 1234567890 },
  street: "118 rue Vieille du Temple",
  postalCode: "75003",
  city: "Paris",
  countryCode: "FR",
  latitude: 48.8617,
  longitude: 2.3626,
  reviewCount: 7,
  averageScore: 4.2,
  createdByUserId: "0199a1f0-0000-7000-8000-000000000002",
  createdAt: "2026-08-30T10:00:00Z",
  updatedAt: "2026-08-30T10:00:00Z",
};

describe("ShopRow", () => {
  it("names the shop and points at its fiche", () => {
    render(<ShopRow shop={BASE} />);
    expect(screen.getByRole("link")).toHaveAttribute("href", `/boutiques/${BASE.id}`);
    expect(screen.getByText("Fromagerie Beaufils")).toBeInTheDocument();
  });

  it("shows the address, which is what tells two namesakes apart", () => {
    render(<ShopRow shop={BASE} />);
    expect(screen.getByText("118 rue Vieille du Temple · 75003 Paris")).toBeInTheDocument();
  });

  it("reads the kind as a word, never as a code", () => {
    render(<ShopRow shop={BASE} />);
    expect(screen.getByText("Fromagerie")).toBeInTheDocument();
    expect(screen.queryByText(/CHEESEMONGER/)).not.toBeInTheDocument();
  });

  it("counts a shop's rating in pine, so it is never a cheese's", () => {
    const { container } = render(<ShopRow shop={BASE} />);
    expect(container.querySelectorAll('circle[fill="var(--color-pine)"]')).toHaveLength(4);
    expect(container.querySelectorAll('circle[fill="var(--color-orange)"]')).toHaveLength(0);
  });

  it("says so plainly when nobody has been yet", () => {
    render(<ShopRow shop={{ ...BASE, averageScore: null, reviewCount: 0 }} />);
    expect(screen.getAllByText("Pas encore d’avis").length).toBeGreaterThan(0);
  });
});
