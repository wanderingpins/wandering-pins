import { describe, expect, it } from "vitest";
import { filterSortPaginate, type DirectoryPin } from "./pin-directory";

function pin(overrides: Partial<DirectoryPin>): DirectoryPin {
  return {
    slug: "AAAAAAA",
    title: "Untitled Pin",
    description: "",
    hasPhoto: false,
    holderDisplayName: "tim",
    verifiedCount: 0,
    registeredAt: new Date("2024-01-01"),
    ...overrides,
  };
}

describe("filterSortPaginate", () => {
  it("defaults to most-traveled (highest verified count) first", () => {
    const pins = [
      pin({ slug: "A", verifiedCount: 1 }),
      pin({ slug: "B", verifiedCount: 5 }),
      pin({ slug: "C", verifiedCount: 3 }),
    ];
    const result = filterSortPaginate(pins, {});
    expect(result.pins.map((p) => p.slug)).toEqual(["B", "C", "A"]);
  });

  it("breaks a verified-count tie by newest first", () => {
    const pins = [
      pin({ slug: "OLD", verifiedCount: 2, registeredAt: new Date("2024-01-01") }),
      pin({ slug: "NEW", verifiedCount: 2, registeredAt: new Date("2024-06-01") }),
    ];
    const result = filterSortPaginate(pins, {});
    expect(result.pins.map((p) => p.slug)).toEqual(["NEW", "OLD"]);
  });

  it("sorts by title alphabetically when asked", () => {
    const pins = [pin({ slug: "A", title: "Zebra" }), pin({ slug: "B", title: "Apple" })];
    const result = filterSortPaginate(pins, { sort: "title" });
    expect(result.pins.map((p) => p.slug)).toEqual(["B", "A"]);
  });

  it("searches across title, description, and holder name case-insensitively", () => {
    const pins = [
      pin({ slug: "A", title: "Disney Mickey Ears" }),
      pin({ slug: "B", description: "a rare disney pin" }),
      pin({ slug: "C", holderDisplayName: "disneyfan" }),
      pin({ slug: "D", title: "Star Wars" }),
    ];
    const result = filterSortPaginate(pins, { search: "DISNEY" });
    expect(result.pins.map((p) => p.slug).sort()).toEqual(["A", "B", "C"]);
  });

  it("paginates and clamps an out-of-range page", () => {
    const pins = Array.from({ length: 30 }, (_, i) => pin({ slug: `P${i}`, verifiedCount: 30 - i }));
    const first = filterSortPaginate(pins, { page: 1 });
    expect(first.pins).toHaveLength(25);
    expect(first.pageCount).toBe(2);
    expect(first.total).toBe(30);

    const second = filterSortPaginate(pins, { page: 2 });
    expect(second.pins).toHaveLength(5);

    const clamped = filterSortPaginate(pins, { page: 99 });
    expect(clamped.page).toBe(2);
  });
});
