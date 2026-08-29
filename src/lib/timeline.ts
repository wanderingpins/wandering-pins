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

export function formatAcquisition(acquiredVia: AcquiredVia, placeLabel: string, acquiredAt: Date): string {
  return `${VERB[acquiredVia]} in ${placeLabel} · ${formatMonthYear(acquiredAt)}`;
}

export function holdingToProse(holding: TimelineHolding): string {
  return `${formatAcquisition(holding.acquiredVia, holding.placeLabel, holding.acquiredAt)} · ${holding.holderDisplayName}`;
}

// A check-in — the pin moved without being released (see HoldingCheckIn in
// the schema) — reuses the same structured-only discipline as
// TimelineHolding: no free-typed text or images ever feed this.
export type TimelineCheckIn = {
  loggedAt: Date;
  placeLabel: string;
  holderDisplayName: string;
};

export function checkInToProse(checkIn: TimelineCheckIn): string {
  return `Spotted in ${checkIn.placeLabel} · ${formatMonthYear(checkIn.loggedAt)} · ${checkIn.holderDisplayName}`;
}

// Merges holding-acquisition events and check-in events into one
// chronologically-ordered timeline (oldest first) — a holder can log that
// a pin moved without releasing it, so the journey isn't just one line per
// holding anymore.
export function buildJourneyTimeline(holdings: TimelineHolding[], checkIns: TimelineCheckIn[]): string[] {
  const holdingEvents = holdings.map((h) => ({ at: h.acquiredAt, line: holdingToProse(h) }));
  const checkInEvents = checkIns.map((c) => ({ at: c.loggedAt, line: checkInToProse(c) }));
  return [...holdingEvents, ...checkInEvents]
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .map((e) => e.line);
}

// username is guaranteed non-null for anyone who's ever held a pin — holding
// one requires having passed requireAppUser's onboarding gate (src/lib/auth.ts)
// first — but typed nullable to match the schema, with a defensive fallback.
export function resolveHolderDisplayName(user: { username: string | null; showNamePublicly: boolean }): string {
  return user.showNamePublicly && user.username ? user.username : "a collector";
}
