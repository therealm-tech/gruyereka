import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CheeseCard } from "@/components/cheeses/CheeseCard";
import type { Cheese } from "@/lib/api/schemas";

const BASE: Cheese = {
  id: "0199a1f0-0000-7000-8000-000000000001",
  name: "Comté",
  milkTypes: ["COW"],
  pasteType: "PRESSED_COOKED",
  designation: "AOP",
  agingMonths: 36,
  photoUrl: null,
  tastingCount: 12,
  averageScore: 4.6,
  createdByUserId: "0199a1f0-0000-7000-8000-000000000002",
  createdAt: "2026-08-30T10:00:00Z",
  updatedAt: "2026-08-30T10:00:00Z",
};

describe("CheeseCard", () => {
  it("names the cheese and points at its fiche", () => {
    render(<CheeseCard cheese={BASE} />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", `/fromages/${BASE.id}`);
    expect(screen.getByText("Comté")).toBeInTheDocument();
  });

  it("reads the vocabulary as words, never as codes", () => {
    render(<CheeseCard cheese={BASE} />);
    expect(screen.getByText("Vache · Pressée cuite · 36 mois")).toBeInTheDocument();
    expect(screen.queryByText(/PRESSED_COOKED/)).not.toBeInTheDocument();
  });

  it("rounds the average down to four holes for a 4,6", () => {
    const { container } = render(<CheeseCard cheese={BASE} />);
    expect(container.querySelectorAll('circle[fill="var(--color-orange)"]')).toHaveLength(4);
    expect(screen.getByText("4,6 · 12 dégustations")).toBeInTheDocument();
  });

  it("says a cheese is unrated rather than showing it as a zero", () => {
    render(<CheeseCard cheese={{ ...BASE, averageScore: null, tastingCount: 0 }} />);
    expect(screen.getByText("Pas encore noté")).toBeInTheDocument();
  });

  it("leaves out the quality badge when there is no scheme", () => {
    render(<CheeseCard cheese={{ ...BASE, designation: null }} />);
    expect(screen.queryByText("AOP")).not.toBeInTheDocument();
  });

  it("falls back to the cheese symbol when no photo has been uploaded", () => {
    const { container } = render(<CheeseCard cheese={BASE} />);
    const mark = container.querySelector("img");
    expect(mark).toHaveAttribute("src", "/brand/cheese.svg");
  });
});
