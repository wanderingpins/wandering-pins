import { describe, expect, it } from "vitest";
import { publicPlace, toPublicHolding, toPublicCheckIn } from "./public-pin";

const TOWN = {
  placeLabel: "Ono, Shasta, United States",
  lat: 40.48,
  lng: -122.62,
  regionOnly: false,
  regionLabel: null,
  regionLat: null,
  regionLng: null,
};
const STATE_ONLY = {
  ...TOWN,
  regionOnly: true,
  regionLabel: "California, United States",
  regionLat: 36.7,
  regionLng: -118.76,
};

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
      regionOnly: false,
      regionLabel: null,
      regionLat: null,
      regionLng: null,
      releasedAt: null,
      verified: true,
      isPrivate: false,
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
      place: { label: "Orlando, FL", lat: 28.5, lng: -81.4 },
      holderDisplayName: "tim",
      isOpen: true,
      verified: true,
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
      ...TOWN,
      acquiredAt: new Date(),
      acquiredVia: "TRADED" as const,
      releasedAt: new Date(),
      verified: false,
      isPrivate: false,
      user: { username: "sarah", showNamePublicly: false },
    };
    expect(toPublicHolding(holding).holderDisplayName).toBe("a collector");
  });

  it("a private stretch shows no name and no place at all", () => {
    const holding = {
      ...TOWN,
      acquiredAt: new Date(),
      acquiredVia: "BOUGHT" as const,
      releasedAt: null,
      verified: true,
      isPrivate: true,
      user: { username: "tim", showNamePublicly: true },
    };
    const result = toPublicHolding(holding);
    expect(result.place).toBeNull();
    expect(result.holderDisplayName).toBe("a collector");
    expect(JSON.stringify(result)).not.toContain("Ono");
    expect(JSON.stringify(result)).not.toContain("tim");
    expect(JSON.stringify(result)).not.toContain("40.48");
  });

  it("'only show the state' shows the state and its coordinates, never the town's", () => {
    const holding = {
      ...STATE_ONLY,
      acquiredAt: new Date(),
      acquiredVia: "BOUGHT" as const,
      releasedAt: null,
      verified: false,
      isPrivate: false,
      user: { username: "tim", showNamePublicly: true },
    };
    const result = toPublicHolding(holding);
    expect(result.place).toEqual({ label: "California, United States", lat: 36.7, lng: -118.76 });
    expect(JSON.stringify(result)).not.toContain("Ono");
    expect(JSON.stringify(result)).not.toContain("40.48");
  });
});

describe("publicPlace", () => {
  it("fails closed when the state is wanted but missing", () => {
    expect(publicPlace({ ...TOWN, regionOnly: true }, false)).toBeNull();
  });

  it("shows the town when nothing is hidden", () => {
    expect(publicPlace(TOWN, false)).toEqual({ label: "Ono, Shasta, United States", lat: 40.48, lng: -122.62 });
  });

  it("private wins over everything", () => {
    expect(publicPlace(STATE_ONLY, true)).toBeNull();
  });
});

describe("toPublicCheckIn", () => {
  it("only carries structured, public fields through — extra properties can't leak", () => {
    const checkInWithPrivateDataAttached = {
      loggedAt: new Date("2024-04-10"),
      placeLabel: "Denver, CO",
      lat: 39.7,
      lng: -105.0,
      regionOnly: false,
      regionLabel: null,
      regionLat: null,
      regionLng: null,
      verified: true,
      holder: { username: "tim", showNamePublicly: true },
      holderIsPrivate: false,
      // Simulates a future query accidentally including private relations.
      note: { body: "Left it on a friend's desk for a week" },
      photos: [{ url: "private/holding-photos/def.jpg" }],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    const result = toPublicCheckIn(checkInWithPrivateDataAttached);

    expect(result).toEqual({
      loggedAt: new Date("2024-04-10"),
      place: { label: "Denver, CO", lat: 39.7, lng: -105.0 },
      holderDisplayName: "tim",
      verified: true,
    });
    expect(result).not.toHaveProperty("note");
    expect(result).not.toHaveProperty("photos");
    expect(JSON.stringify(result)).not.toContain("friend's desk");
    expect(JSON.stringify(result)).not.toContain("holding-photos");
  });

  it("honours show_name_publicly", () => {
    const checkIn = {
      ...TOWN,
      loggedAt: new Date(),
      verified: false,
      holder: { username: "sarah", showNamePublicly: false },
      holderIsPrivate: false,
    };
    expect(toPublicCheckIn(checkIn).holderDisplayName).toBe("a collector");
  });

  it("follows the parent holding's privacy", () => {
    const checkIn = {
      ...TOWN,
      loggedAt: new Date(),
      verified: false,
      holder: { username: "tim", showNamePublicly: true },
      holderIsPrivate: true,
    };
    const result = toPublicCheckIn(checkIn);
    expect(result.place).toBeNull();
    expect(result.holderDisplayName).toBe("a collector");
  });
});
