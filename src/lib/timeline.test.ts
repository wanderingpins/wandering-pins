import { describe, expect, it } from "vitest";
import { buildJourneyRows, checkInToProse, formatMonthYear, holdingToProse, resolveHolderDisplayName } from "./timeline";

describe("formatMonthYear", () => {
  it("formats as 'Month YYYY'", () => {
    expect(formatMonthYear(new Date(Date.UTC(2024, 2, 15)))).toBe("March 2024");
  });
});

describe("holdingToProse", () => {
  it("matches the brief's worked example format", () => {
    expect(
      holdingToProse({
        acquiredAt: new Date(Date.UTC(2024, 2, 1)),
        acquiredVia: "BOUGHT",
        placeLabel: "Orlando, FL",
        holderDisplayName: "Tim",
      })
    ).toBe("Bought in Orlando, FL · March 2024 · Tim");

    expect(
      holdingToProse({
        acquiredAt: new Date(Date.UTC(2024, 5, 1)),
        acquiredVia: "TRADED",
        placeLabel: "Denver, CO",
        holderDisplayName: "Sarah",
      })
    ).toBe("Traded in Denver, CO · June 2024 · Sarah");
  });

  it("falls back to 'a collector' for opted-out holders", () => {
    expect(
      holdingToProse({
        acquiredAt: new Date(Date.UTC(2024, 10, 1)),
        acquiredVia: "TRADED",
        placeLabel: "Osaka, Japan",
        holderDisplayName: "a collector",
      })
    ).toBe("Traded in Osaka, Japan · November 2024 · a collector");
  });
});

describe("checkInToProse", () => {
  it("formats a check-in as a 'Spotted in' line", () => {
    expect(
      checkInToProse({ loggedAt: new Date(Date.UTC(2024, 3, 10)), placeLabel: "Denver, CO", holderDisplayName: "Tim" })
    ).toBe("Spotted in Denver, CO · April 2024 · Tim");
  });
});

describe("buildJourneyRows", () => {
  it("renders one row per holding in the given order when there are no check-ins", () => {
    const rows = buildJourneyRows(
      [
        { id: "h1", acquiredAt: new Date(Date.UTC(2024, 2, 1)), acquiredVia: "BOUGHT", placeLabel: "Orlando, FL", holderDisplayName: "Tim" },
        { id: "h2", acquiredAt: new Date(Date.UTC(2024, 5, 1)), acquiredVia: "TRADED", placeLabel: "Denver, CO", holderDisplayName: "Sarah" },
      ],
      []
    );
    expect(rows).toEqual([
      { kind: "holding", id: "h1", at: new Date(Date.UTC(2024, 2, 1)), line: "Bought in Orlando, FL · March 2024 · Tim" },
      { kind: "holding", id: "h2", at: new Date(Date.UTC(2024, 5, 1)), line: "Traded in Denver, CO · June 2024 · Sarah" },
    ]);
  });

  it("interleaves check-ins with holdings in chronological order, regardless of input order", () => {
    const rows = buildJourneyRows(
      [
        { id: "h1", acquiredAt: new Date(Date.UTC(2024, 2, 1)), acquiredVia: "BOUGHT", placeLabel: "Orlando, FL", holderDisplayName: "Tim" },
        { id: "h2", acquiredAt: new Date(Date.UTC(2024, 8, 1)), acquiredVia: "TRADED", placeLabel: "Seattle, WA", holderDisplayName: "Sarah" },
      ],
      [{ id: "c1", loggedAt: new Date(Date.UTC(2024, 5, 1)), placeLabel: "Denver, CO", holderDisplayName: "Tim" }]
    );
    expect(rows.map((r) => r.line)).toEqual([
      "Bought in Orlando, FL · March 2024 · Tim",
      "Spotted in Denver, CO · June 2024 · Tim",
      "Traded in Seattle, WA · September 2024 · Sarah",
    ]);
    expect(rows.map((r) => ({ kind: r.kind, id: r.id }))).toEqual([
      { kind: "holding", id: "h1" },
      { kind: "checkin", id: "c1" },
      { kind: "holding", id: "h2" },
    ]);
  });
});

describe("resolveHolderDisplayName", () => {
  it("shows the username when opted in", () => {
    expect(resolveHolderDisplayName({ username: "tim", showNamePublicly: true })).toBe("tim");
  });

  it("falls back to 'a collector' when opted out", () => {
    expect(resolveHolderDisplayName({ username: "tim", showNamePublicly: false })).toBe("a collector");
  });

  it("falls back to 'a collector' if username is somehow still null", () => {
    expect(resolveHolderDisplayName({ username: null, showNamePublicly: true })).toBe("a collector");
  });
});
