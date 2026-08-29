import { describe, expect, it } from "vitest";
import { normalizeSeriesKey } from "./series";

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
