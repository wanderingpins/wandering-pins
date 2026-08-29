import { describe, expect, it } from "vitest";
import { buildJourneyTimeline, checkInToProse, formatMonthYear, holdingToProse, resolveHolderDisplayName } from "./timeline";

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

describe("buildJourneyTimeline", () => {
  it("renders one line per holding in the given order when there are no check-ins", () => {
    const lines = buildJourneyTimeline(
      [
        { acquiredAt: new Date(Date.UTC(2024, 2, 1)), acquiredVia: "BOUGHT", placeLabel: "Orlando, FL", holderDisplayName: "Tim" },
        { acquiredAt: new Date(Date.UTC(2024, 5, 1)), acquiredVia: "TRADED", placeLabel: "Denver, CO", holderDisplayName: "Sarah" },
      ],
      []
    );
    expect(lines).toEqual([
      "Bought in Orlando, FL · March 2024 · Tim",
      "Traded in Denver, CO · June 2024 · Sarah",
    ]);
  });

  it("interleaves check-ins with holdings in chronological order, regardless of input order", () => {
    const lines = buildJourneyTimeline(
      [
        { acquiredAt: new Date(Date.UTC(2024, 2, 1)), acquiredVia: "BOUGHT", placeLabel: "Orlando, FL", holderDisplayName: "Tim" },
        { acquiredAt: new Date(Date.UTC(2024, 8, 1)), acquiredVia: "TRADED", placeLabel: "Seattle, WA", holderDisplayName: "Sarah" },
      ],
      [{ loggedAt: new Date(Date.UTC(2024, 5, 1)), placeLabel: "Denver, CO", holderDisplayName: "Tim" }]
    );
    expect(lines).toEqual([
      "Bought in Orlando, FL · March 2024 · Tim",
      "Spotted in Denver, CO · June 2024 · Tim",
      "Traded in Seattle, WA · September 2024 · Sarah",
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
