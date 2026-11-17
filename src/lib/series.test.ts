import { describe, expect, it } from "vitest";
import { canRemoveSeriesItem, normalizeSeriesKey } from "./series";

describe("normalizeSeriesKey", () => {
  it("collapses whitespace and case differences into the same key", () => {
    expect(normalizeSeriesKey("Star Wars")).toBe("star wars");
    expect(normalizeSeriesKey("  star   wars  ")).toBe("star wars");
    expect(normalizeSeriesKey("STAR WARS")).toBe("star wars");
  });

  it("treats different series as different keys", () => {
    expect(normalizeSeriesKey("Star Wars")).not.toBe(normalizeSeriesKey("Star Trek"));
  });
});

describe("canRemoveSeriesItem", () => {
  const item = (createdBy: string, claimers: string[]) => ({ createdBy, claims: claimers.map((userId) => ({ userId })) });

  it("lets whoever added it remove it while nobody else has claimed it", () => {
    expect(canRemoveSeriesItem(item("me", []), "me", false)).toBe(true);
    expect(canRemoveSeriesItem(item("me", ["me"]), "me", false)).toBe(true);
  });

  it("stops them once someone else has claimed it", () => {
    expect(canRemoveSeriesItem(item("me", ["me", "you"]), "me", false)).toBe(false);
    expect(canRemoveSeriesItem(item("me", ["you"]), "me", false)).toBe(false);
  });

  it("never lets anyone else remove it, but always lets an admin", () => {
    expect(canRemoveSeriesItem(item("me", []), "you", false)).toBe(false);
    expect(canRemoveSeriesItem(item("me", ["you"]), "admin", true)).toBe(true);
    expect(canRemoveSeriesItem(item("me", []), undefined, true)).toBe(false);
  });
});
