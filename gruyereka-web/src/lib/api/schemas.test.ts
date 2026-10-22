import { describe, expect, it } from "vitest";
import { MAX_TASTING_PHOTOS, tastingSchema } from "@/lib/api/schemas";

const TASTING_ID = "0199a1f0-0000-7000-8000-000000000020";
const PHOTO_ID = "0199a1f0-0000-7000-8000-000000000040";

function wire(photos: unknown): unknown {
  return {
    id: TASTING_ID,
    userId: "0199a1f0-0000-7000-8000-000000000002",
    shopId: "0199a1f0-0000-7000-8000-000000000010",
    tastedOn: "2026-08-30",
    items: [
      {
        id: "0199a1f0-0000-7000-8000-000000000030",
        cheeseId: "0199a1f0-0000-7000-8000-000000000001",
        rating: "GOOD",
        pricePerKg: null,
        comment: null,
      },
    ],
    photos,
    createdAt: "2026-08-30T10:00:00Z",
    updatedAt: "2026-08-30T10:00:00Z",
  };
}

const photo = (id: string) => ({ id, url: `/api/v1/tastings/${TASTING_ID}/photos/${id}` });

describe("tastingSchema", () => {
  it("reads a visit's photos, oldest first as sent", () => {
    const parsed = tastingSchema.parse(wire([photo(PHOTO_ID)]));
    expect(parsed.photos).toEqual([photo(PHOTO_ID)]);
  });

  it("reads a visit without photos as an empty list", () => {
    expect(tastingSchema.parse(wire([])).photos).toEqual([]);
  });

  it("fails loudly when the API leaves the list out", () => {
    expect(tastingSchema.safeParse(wire(undefined)).success).toBe(false);
  });

  it("refuses a photo whose id is not a uuid", () => {
    expect(tastingSchema.safeParse(wire([{ id: "1", url: "/x" }])).success).toBe(false);
  });

  it("refuses more photos than a visit can hold", () => {
    const tooMany = Array.from({ length: MAX_TASTING_PHOTOS + 1 }, (_, index) =>
      photo(`0199a1f0-0000-7000-8000-0000000001${String(index).padStart(2, "0")}`),
    );
    expect(tastingSchema.safeParse(wire(tooMany)).success).toBe(false);
  });
});
