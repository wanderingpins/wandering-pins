import type { AcquiredVia } from "@/generated/prisma/client";
import { resolveHolderDisplayName } from "@/lib/timeline";

// Brief section 7: the public pin page may render structured fields ONLY —
// no user-typed text (titles, notes) and no user-uploaded images, ever.
// This is the single seam every field on /p/[slug] passes through, so
// "did we accidentally leak a private field" is one function to audit
// (and one test to hold the line — see public-pin.test.ts) instead of
// trusting every call site to remember by hand.
export type PublicHolding = {
  acquiredAt: Date;
  acquiredVia: AcquiredVia;
  placeLabel: string;
  holderDisplayName: string;
  lat: number;
  lng: number;
  isOpen: boolean;
};

type HoldingLike = {
  acquiredAt: Date;
  acquiredVia: AcquiredVia;
  placeLabel: string;
  lat: number;
  lng: number;
  releasedAt: Date | null;
  user: { displayName: string; showNamePublicly: boolean };
};

export function toPublicHolding(holding: HoldingLike): PublicHolding {
  return {
    acquiredAt: holding.acquiredAt,
    acquiredVia: holding.acquiredVia,
    placeLabel: holding.placeLabel,
    holderDisplayName: resolveHolderDisplayName(holding.user),
    lat: holding.lat,
    lng: holding.lng,
    isOpen: holding.releasedAt === null,
  };
}
