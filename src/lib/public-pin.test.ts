import { describe, expect, it } from "vitest";
import { toPublicHolding, toPublicCheckIn } from "./public-pin";

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
      user: { username: "tim", showNamePublicly: true },
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
      holderDisplayName: "tim",
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
      user: { username: "sarah", showNamePublicly: false },
    };
    expect(toPublicHolding(holding).holderDisplayName).toBe("a collector");
  });
});

describe("toPublicCheckIn", () => {
  it("only carries structured, public fields through — extra properties can't leak", () => {
    const checkInWithPrivateDataAttached = {
      loggedAt: new Date("2024-04-10"),
      placeLabel: "Denver, CO",
      lat: 39.7,
      lng: -105.0,
      holder: { username: "tim", showNamePublicly: true },
      // Simulates a future query accidentally including private relations.
      note: { body: "Left it on a friend's desk for a week" },
      photos: [{ url: "private/holding-photos/def.jpg" }],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    const result = toPublicCheckIn(checkInWithPrivateDataAttached);

    expect(result).toEqual({
      loggedAt: new Date("2024-04-10"),
      placeLabel: "Denver, CO",
      holderDisplayName: "tim",
      lat: 39.7,
      lng: -105.0,
    });
    expect(result).not.toHaveProperty("note");
    expect(result).not.toHaveProperty("photos");
    expect(JSON.stringify(result)).not.toContain("friend's desk");
    expect(JSON.stringify(result)).not.toContain("holding-photos");
  });

  it("honours show_name_publicly", () => {
    const checkIn = {
      loggedAt: new Date(),
      placeLabel: "Osaka, Japan",
      lat: 34.7,
      lng: 135.5,
      holder: { username: "sarah", showNamePublicly: false },
    };
    expect(toPublicCheckIn(checkIn).holderDisplayName).toBe("a collector");
  });
});
