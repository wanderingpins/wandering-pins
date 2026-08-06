import type { AcquiredVia } from "@/generated/prisma/client";

// Structured-only inputs, per brief section 7: no free-typed text or
// user-uploaded images ever feed this — every word here is generated from
// an enum, a geocoded place, or a date.
export type TimelineHolding = {
  acquiredAt: Date;
  acquiredVia: AcquiredVia;
  placeLabel: string;
  holderDisplayName: string;
};

const VERB: Record<AcquiredVia, string> = {
  BOUGHT: "Bought",
  TRADED: "Traded",
  GIFT: "Gifted",
  FOUND: "Found",
  OTHER: "Acquired",
};

// acquired_at is a calendar date with no meaningful time-of-day — format in
// UTC so the displayed month doesn't shift with the server/browser's local
// timezone (e.g. a March 1 UTC date reading as "February" west of Greenwich).
export function formatMonthYear(date: Date): string {
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(date);
}

export function holdingToProse(holding: TimelineHolding): string {
  return `${VERB[holding.acquiredVia]} in ${holding.placeLabel} · ${formatMonthYear(holding.acquiredAt)} · ${holding.holderDisplayName}`;
}

// Expects holdings already sorted ascending by acquiredAt (oldest first).
export function buildTimeline(holdings: TimelineHolding[]): string[] {
  return holdings.map(holdingToProse);
}

export function resolveHolderDisplayName(user: { displayName: string; showNamePublicly: boolean }): string {
  return user.showNamePublicly ? user.displayName : "a collector";
}
