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

// One line in the journey, tagged with which row (holding or check-in) it
// came from — callers that need to attach something to a specific line
// (e.g. an inline "add details" affordance, gated to the row's owner) use
// `id`/`kind` to look the row back up; callers that just want prose can
// ignore both and read `line`.
export type JourneyRow =
  | { kind: "holding"; id: string; at: Date; line: string }
  | { kind: "checkin"; id: string; at: Date; line: string };

// Merges holding-acquisition events and check-in events into one
// chronologically-ordered timeline (oldest first) — a holder can log that
// a pin moved without releasing it, so the journey isn't just one line per
// holding anymore.
export function buildJourneyRows(
  holdings: (TimelineHolding & { id: string })[],
  checkIns: (TimelineCheckIn & { id: string })[]
): JourneyRow[] {
  const holdingRows: JourneyRow[] = holdings.map((h) => ({ kind: "holding", id: h.id, at: h.acquiredAt, line: holdingToProse(h) }));
  const checkInRows: JourneyRow[] = checkIns.map((c) => ({ kind: "checkin", id: c.id, at: c.loggedAt, line: checkInToProse(c) }));
  return [...holdingRows, ...checkInRows].sort((a, b) => a.at.getTime() - b.at.getTime());
}

// username is guaranteed non-null for anyone who's ever held a pin — holding
// one requires having passed requireAppUser's onboarding gate (src/lib/auth.ts)
// first — but typed nullable to match the schema, with a defensive fallback.
export function resolveHolderDisplayName(user: { username: string | null; showNamePublicly: boolean }): string {
  return user.showNamePublicly && user.username ? user.username : "a collector";
}
