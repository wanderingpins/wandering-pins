import { describe, expect, it } from "vitest";
import { geocodePlace } from "./geocode";

describe("geocodePlace", () => {
  // Regression: MapTiler tags US "consolidated city-county" places (Denver,
  // San Francisco, Nashville, ...) as `county`, not `place`. Filtering to
  // types=place alone silently missed the real city and matched an
  // unrelated same-named suburb elsewhere in the world instead (in
  // production, "Denver, CO" resolved to a Johannesburg neighborhood).
  it("resolves a consolidated city-county to the actual city, not a same-named place elsewhere", async () => {
    const result = await geocodePlace("Denver, CO");
    expect(result?.placeLabel).toContain("Colorado");
    expect(result?.lat).toBeCloseTo(39.74, 0);
    expect(result?.lng).toBeCloseTo(-104.98, 0);
  });

  it("resolves an ordinary city", async () => {
    const result = await geocodePlace("Orlando, FL");
    expect(result?.placeLabel).toContain("Florida");
  });

  it("returns coarse (rounded) coordinates, not precise ones", async () => {
    const result = await geocodePlace("Orlando, FL");
    expect(result!.lat.toString().split(".")[1]?.length ?? 0).toBeLessThanOrEqual(2);
    expect(result!.lng.toString().split(".")[1]?.length ?? 0).toBeLessThanOrEqual(2);
  });
});
