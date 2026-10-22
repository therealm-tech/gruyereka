import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  CheeseTastingRow,
  TastingRow,
  type TastingSubject,
} from "@/components/tastings/TastingRow";
import type { Cheese, Tasting, TastingItem } from "@/lib/api/schemas";

const COMTE_ID = "0199a1f0-0000-7000-8000-000000000001";
const BRIE_ID = "0199a1f0-0000-7000-8000-000000000003";

function cheese(id: string, name: string): Cheese {
  return {
    id,
    name,
    milkTypes: ["COW"],
    pasteType: "PRESSED_COOKED",
    designation: null,
    agingMonths: null,
    tastingCount: 1,
    averageScore: 4,
    createdByUserId: "0199a1f0-0000-7000-8000-000000000002",
    createdAt: "2026-08-30T10:00:00Z",
    updatedAt: "2026-08-30T10:00:00Z",
  };
}

const CHEESES: ReadonlyMap<string, Cheese> = new Map([
  [COMTE_ID, cheese(COMTE_ID, "Comté")],
  [BRIE_ID, cheese(BRIE_ID, "Brie")],
]);

const COMTE: TastingItem = {
  id: "0199a1f0-0000-7000-8000-000000000030",
  cheeseId: COMTE_ID,
  rating: "DELICIOUS",
  pricePerKg: { amountCents: 3250, currency: "EUR" },
  comment: "Bien fruité, une pointe de cristaux.",
};

const BRIE: TastingItem = {
  id: "0199a1f0-0000-7000-8000-000000000031",
  cheeseId: BRIE_ID,
  rating: "MEH",
  pricePerKg: null,
  comment: null,
};

const VISIT: Tasting = {
  id: "0199a1f0-0000-7000-8000-000000000020",
  userId: "0199a1f0-0000-7000-8000-000000000002",
  shopId: "0199a1f0-0000-7000-8000-000000000010",
  tastedOn: "2026-08-30",
  items: [COMTE, BRIE],
  photos: [],
  createdAt: "2026-08-30T10:00:00Z",
  updatedAt: "2026-08-30T10:00:00Z",
};

const PHOTO_IDS = ["0199a1f0-0000-7000-8000-000000000040", "0199a1f0-0000-7000-8000-000000000041"];

const PHOTOGRAPHED: Tasting = {
  ...VISIT,
  photos: PHOTO_IDS.map((id) => ({ id, url: `/api/v1/tastings/${VISIT.id}/photos/${id}` })),
};

const SHOP: TastingSubject = {
  label: "Fromagerie Beaufils",
  href: { pathname: "/boutiques/0199a1f0-0000-7000-8000-000000000010" },
  tone: "shop",
};

describe("TastingRow", () => {
  it("gives every cheese of one basket its own score", () => {
    render(<TastingRow tasting={VISIT} cheeses={CHEESES} subject={SHOP} mine={false} />);

    expect(screen.getByText("Comté")).toBeInTheDocument();
    expect(screen.getByText("Délicieux")).toBeInTheDocument();
    expect(screen.getByText("Brie")).toBeInTheDocument();
    expect(screen.getByText("Bof")).toBeInTheDocument();
  });

  it("prices the cheese that had a price, and stays quiet about the other", () => {
    render(<TastingRow tasting={VISIT} cheeses={CHEESES} subject={SHOP} mine={false} />);
    expect(screen.getAllByText(/€\/kg/)).toHaveLength(1);
    expect(screen.getByText("32,50 €/kg")).toBeInTheDocument();
  });

  it("carries the day, which is what makes it a log entry", () => {
    render(<TastingRow tasting={VISIT} cheeses={CHEESES} subject={SHOP} mine={false} />);
    expect(screen.getByText("30.08.2026")).toBeInTheDocument();
  });

  it("still reads when a cheese's fiche is gone", () => {
    render(<TastingRow tasting={VISIT} cheeses={new Map()} subject={SHOP} mine={false} />);
    expect(screen.getAllByText("Fromage retiré")).toHaveLength(2);
    expect(screen.getByText("Délicieux")).toBeInTheDocument();
  });

  it("names no shop where the page is already the shop", () => {
    render(<TastingRow tasting={VISIT} cheeses={CHEESES} mine={false} />);
    expect(screen.queryByText("Fromagerie Beaufils")).not.toBeInTheDocument();
    expect(screen.getByText("Comté")).toBeInTheDocument();
  });

  it("offers a correction only where one is allowed", () => {
    const { rerender } = render(
      <TastingRow tasting={VISIT} cheeses={CHEESES} subject={SHOP} mine />,
    );
    expect(screen.queryByRole("link", { name: "Corriger" })).not.toBeInTheDocument();

    rerender(<TastingRow tasting={VISIT} cheeses={CHEESES} subject={SHOP} mine editable />);
    expect(screen.getByRole("link", { name: "Corriger" })).toHaveAttribute(
      "href",
      `/degustations/${VISIT.id}/modifier`,
    );
  });
});

describe("TastingRow photos", () => {
  it("shows each photo as a lazy thumbnail through this origin's relay", () => {
    render(<TastingRow tasting={PHOTOGRAPHED} cheeses={CHEESES} subject={SHOP} mine={false} />);

    const thumbnails = screen.getAllByRole("img", { name: /^Visite du 30\.08\.2026/ });
    expect(thumbnails).toHaveLength(2);
    expect(thumbnails[0]).toHaveAttribute("src", `/photos/${VISIT.id}/${PHOTO_IDS[0]}`);
    expect(thumbnails[0]).toHaveAttribute("loading", "lazy");
    expect(thumbnails[1]).toHaveAccessibleName("Visite du 30.08.2026, vue 2 sur 2");
  });

  it("opens the full image on its own, in a new tab", () => {
    render(<TastingRow tasting={PHOTOGRAPHED} cheeses={CHEESES} subject={SHOP} mine={false} />);
    const link = screen.getByRole("link", { name: /vue 1 sur 2/ });
    expect(link).toHaveAttribute("href", `/photos/${VISIT.id}/${PHOTO_IDS[0]}`);
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("shows nothing at all for a visit without photos", () => {
    render(<TastingRow tasting={VISIT} cheeses={CHEESES} subject={SHOP} mine={false} />);
    expect(screen.queryByRole("list", { name: "Photos de la visite" })).not.toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /^Visite du/ })).not.toBeInTheDocument();
  });

  it("shows the visit's photos on a cheese's fiche too", () => {
    render(<CheeseTastingRow tasting={PHOTOGRAPHED} item={COMTE} shop={SHOP} mine={false} />);
    expect(screen.getAllByRole("img", { name: /^Visite du/ })).toHaveLength(2);
  });
});

describe("CheeseTastingRow", () => {
  it("shows this cheese's own score and price, not the basket's", () => {
    render(<CheeseTastingRow tasting={VISIT} item={COMTE} shop={SHOP} mine={false} />);

    expect(screen.getByText("Délicieux")).toBeInTheDocument();
    expect(screen.getByText("32,50 €/kg")).toBeInTheDocument();
    // The brie was in the same basket and has no business on the comté's fiche.
    expect(screen.queryByText("Bof")).not.toBeInTheDocument();
  });

  it("counts what else was tasted that day rather than listing it", () => {
    render(<CheeseTastingRow tasting={VISIT} item={COMTE} shop={SHOP} mine={false} />);
    expect(screen.getByText(/1 autre fromage ce jour-là/)).toBeInTheDocument();
  });

  it("says nothing about company when there was none", () => {
    const alone: Tasting = { ...VISIT, items: [COMTE] };
    render(<CheeseTastingRow tasting={alone} item={COMTE} shop={SHOP} mine={false} />);
    expect(screen.queryByText(/autre fromage/)).not.toBeInTheDocument();
  });

  it("links to the shop it was bought from", () => {
    render(<CheeseTastingRow tasting={VISIT} item={COMTE} shop={SHOP} mine={false} />);
    expect(screen.getByRole("link", { name: "Fromagerie Beaufils" })).toHaveAttribute(
      "href",
      "/boutiques/0199a1f0-0000-7000-8000-000000000010",
    );
  });
});
