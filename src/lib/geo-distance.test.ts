import { describe, expect, it } from "vitest";
import { haversineDistanceKm } from "./geo-distance";

describe("haversineDistanceKm", () => {
  it("returns 0 for the same point", () => {
    expect(haversineDistanceKm(28.5, -81.4, 28.5, -81.4)).toBeCloseTo(0, 5);
  });

  it("matches the known distance between Orlando, FL and Denver, CO (~2470 km)", () => {
    const distance = haversineDistanceKm(28.5383, -81.3792, 39.7392, -104.9903);
    expect(distance).toBeGreaterThan(2400);
    expect(distance).toBeLessThan(2550);
  });

  it("is symmetric regardless of argument order", () => {
    const a = haversineDistanceKm(28.5, -81.4, 39.7, -105.0);
    const b = haversineDistanceKm(39.7, -105.0, 28.5, -81.4);
    expect(a).toBeCloseTo(b, 6);
  });
});
