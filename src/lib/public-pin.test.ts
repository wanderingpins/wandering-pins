import { describe, expect, it } from "vitest";
import { toPublicHolding } from "./public-pin";

describe("toPublicHolding", () => {
  // The DoD in brief section 12 requires a test asserting no user-typed
  // text or user-uploaded image ever reaches the public page. Even if a
  // future query change starts fetching title/notes/photos relations
  // alongside a holding, this proves the mapper still can't leak them:
  // it only reads specific known-public fields off the input, so extra
  // properties (simulated below via `as any`) are structurally impossible
  // to pass through — there's no `...rest` spread that could smuggle them.
  it("only carries structured, public fields through — extra properties can't leak", () => {
    const holdingWithPrivateDataAttached = {
      acquiredAt: new Date("2024-03-01"),
      acquiredVia: "BOUGHT" as const,
      placeLabel: "Orlando, FL",
      lat: 28.5,
      lng: -81.4,
      releasedAt: null,
      user: { displayName: "Tim", showNamePublicly: true },
      // Simulates a future query accidentally including private relations.
      title: { title: "My secret nickname for this pin" },
      note: { body: "Bought it with my daughter, she picked it out" },
      photos: [{ url: "private/holding-photos/abc.jpg" }],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    const result = toPublicHolding(holdingWithPrivateDataAttached);

    expect(result).toEqual({
      acquiredAt: new Date("2024-03-01"),
      acquiredVia: "BOUGHT",
      placeLabel: "Orlando, FL",
      holderDisplayName: "Tim",
      lat: 28.5,
      lng: -81.4,
      isOpen: true,
    });
    expect(result).not.toHaveProperty("title");
    expect(result).not.toHaveProperty("note");
    expect(result).not.toHaveProperty("photos");
    expect(JSON.stringify(result)).not.toContain("secret nickname");
    expect(JSON.stringify(result)).not.toContain("daughter");
    expect(JSON.stringify(result)).not.toContain("holding-photos");
  });

  it("honours show_name_publicly", () => {
    const holding = {
      acquiredAt: new Date(),
      acquiredVia: "TRADED" as const,
      placeLabel: "Denver, CO",
      lat: 39.7,
      lng: -105.0,
      releasedAt: new Date(),
      user: { displayName: "Sarah", showNamePublicly: false },
    };
    expect(toPublicHolding(holding).holderDisplayName).toBe("a collector");
  });
});
