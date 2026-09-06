import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RatingHoles } from "@/components/ui/RatingHoles";

describe("RatingHoles", () => {
  it("always draws the whole scale, filled or not", () => {
    const { container } = render(<RatingHoles filled={3} label="Noté Bof" />);
    expect(container.querySelectorAll("circle")).toHaveLength(5);
  });

  it("fills exactly as many holes as it is told", () => {
    const { container } = render(<RatingHoles filled={2} label="Noté Médiocre" />);
    const filled = container.querySelectorAll('circle[fill="var(--color-orange)"]');
    expect(filled).toHaveLength(2);
  });

  it("counts a shop in pine, so the two scales never blur", () => {
    const { container } = render(<RatingHoles filled={4} tone="shop" label="Noté 4 sur 5" />);
    expect(container.querySelectorAll('circle[fill="var(--color-pine)"]')).toHaveLength(4);
  });

  it("says the rating out loud for anyone not seeing the holes", () => {
    render(<RatingHoles filled={5} label="Noté Délicieux" />);
    expect(screen.getByRole("img", { name: "Noté Délicieux" })).toBeInTheDocument();
  });
});
