import { describe, expect, it } from "vitest";
import { filterSortPaginate, type DirectoryPin } from "./pin-directory";

function pin(overrides: Partial<DirectoryPin>): DirectoryPin {
  return {
    number: 1,
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
      pin({ number: 1, verifiedCount: 1 }),
      pin({ number: 2, verifiedCount: 5 }),
      pin({ number: 3, verifiedCount: 3 }),
    ];
    const result = filterSortPaginate(pins, {});
    expect(result.pins.map((p) => p.number)).toEqual([2, 3, 1]);
  });

  it("breaks a verified-count tie by newest first", () => {
    const pins = [
      pin({ number: 10, verifiedCount: 2, registeredAt: new Date("2024-01-01") }),
      pin({ number: 11, verifiedCount: 2, registeredAt: new Date("2024-06-01") }),
    ];
    const result = filterSortPaginate(pins, {});
    expect(result.pins.map((p) => p.number)).toEqual([11, 10]);
  });

  it("sorts by title alphabetically when asked", () => {
    const pins = [pin({ number: 1, title: "Zebra" }), pin({ number: 2, title: "Apple" })];
    const result = filterSortPaginate(pins, { sort: "title" });
    expect(result.pins.map((p) => p.number)).toEqual([2, 1]);
  });

  it("searches across title, description, and holder name case-insensitively", () => {
    const pins = [
      pin({ number: 1, title: "Disney Mickey Ears" }),
      pin({ number: 2, description: "a rare disney pin" }),
      pin({ number: 3, holderDisplayName: "disneyfan" }),
      pin({ number: 4, title: "Star Wars" }),
    ];
    const result = filterSortPaginate(pins, { search: "DISNEY" });
    expect(result.pins.map((p) => p.number).sort()).toEqual([1, 2, 3]);
  });

  it("paginates and clamps an out-of-range page", () => {
    const pins = Array.from({ length: 30 }, (_, i) => pin({ number: i + 1, verifiedCount: 30 - i }));
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
