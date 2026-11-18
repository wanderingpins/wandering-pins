import type { AcquiredVia } from "@/generated/prisma/client";
import { resolveHolderDisplayName } from "@/lib/timeline";

// Brief section 7: the public pin page may render structured fields ONLY —
// no user-typed text (titles, notes) and no user-uploaded images, ever.
// This is the single seam every field on /p/[number] passes through, so
// "did we accidentally leak a private field" is one function to audit
// (and one test to hold the line — see public-pin.test.ts) instead of
// trusting every call site to remember by hand.
//
// It is also where the holder's privacy choices are applied (PinHolding.
// isPrivate and regionOnly, added 2026-11-17): a place is only ever made
// public through publicPlace, and a name through publicHolderName.

// What a stranger sees for a private stretch, in place of the town.
export const PRIVATE_PLACE_LABEL = "Somewhere private";
// ...and in place of the holder's username.
export const PRIVATE_HOLDER_NAME = "a collector";

export type PublicPlace = { label: string; lat: number; lng: number };

export type PlaceFields = {
  placeLabel: string;
  lat: number;
  lng: number;
  regionOnly: boolean;
  regionLabel: string | null;
  regionLat: number | null;
  regionLng: number | null;
};

// The place a stranger may see for a holding or check-in: nothing at all for
// a private stretch, the state for "only show the state", else the town.
// Fails closed: regionOnly with the region missing shows nothing rather than
// falling back to the town.
export function publicPlace(row: PlaceFields, isPrivate: boolean): PublicPlace | null {
  if (isPrivate) return null;
  if (row.regionOnly) {
    if (!row.regionLabel || row.regionLat == null || row.regionLng == null) return null;
    return { label: row.regionLabel, lat: row.regionLat, lng: row.regionLng };
  }
  return { label: row.placeLabel, lat: row.lat, lng: row.lng };
}

export function publicHolderName(
  user: { username: string | null; showNamePublicly: boolean },
  isPrivate: boolean
): string {
  return isPrivate ? PRIVATE_HOLDER_NAME : resolveHolderDisplayName(user);
}

export type PublicHolding = {
  acquiredAt: Date;
  acquiredVia: AcquiredVia;
  /** null when the holder keeps this stretch private. */
  place: PublicPlace | null;
  holderDisplayName: string;
  isOpen: boolean;
  verified: boolean;
};

type HoldingLike = PlaceFields & {
  acquiredAt: Date;
  acquiredVia: AcquiredVia;
  releasedAt: Date | null;
  verified: boolean;
  isPrivate: boolean;
  user: { username: string | null; showNamePublicly: boolean };
};

export function toPublicHolding(holding: HoldingLike): PublicHolding {
  return {
    acquiredAt: holding.acquiredAt,
    acquiredVia: holding.acquiredVia,
    place: publicPlace(holding, holding.isPrivate),
    holderDisplayName: publicHolderName(holding.user, holding.isPrivate),
    isOpen: holding.releasedAt === null,
    verified: holding.verified,
  };
}

// A check-in's public fields — same discipline as toPublicHolding above:
// the holder and the privacy choice come from the *parent holding*, since a
// check-in doesn't have its own. description/photos never pass through this.
export type PublicCheckIn = {
  loggedAt: Date;
  place: PublicPlace | null;
  holderDisplayName: string;
  verified: boolean;
};

type CheckInLike = PlaceFields & {
  loggedAt: Date;
  verified: boolean;
  holder: { username: string | null; showNamePublicly: boolean };
  holderIsPrivate: boolean;
};

export function toPublicCheckIn(checkIn: CheckInLike): PublicCheckIn {
  return {
    loggedAt: checkIn.loggedAt,
    place: publicPlace(checkIn, checkIn.holderIsPrivate),
    holderDisplayName: publicHolderName(checkIn.holder, checkIn.holderIsPrivate),
    verified: checkIn.verified,
  };
}
