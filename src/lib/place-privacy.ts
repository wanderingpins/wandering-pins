import { prisma } from "@/lib/prisma";
import { regionForPoint } from "@/lib/geocode";

// Switches one stored place (an acquisition or a check-in) between showing
// the town and "only show the state" (see PinHolding.regionOnly). Callers
// check ownership first. A region looked up once is kept on the row, so
// switching back and forth costs one geocoder call at most.
//
// Returns false when the state couldn't be looked up — the row is left as it
// was, so the town is never published by accident... nor hidden without the
// caller knowing it failed.
type PlaceRow = {
  id: string;
  lat: number;
  lng: number;
  regionLabel: string | null;
  regionLat: number | null;
  regionLng: number | null;
};

export async function setPlaceRegionOnly(
  kind: "holding" | "checkin",
  row: PlaceRow,
  regionOnly: boolean,
  // Lets a batch (Settings' "apply to all my places") share lookups between
  // rows in the same town.
  cache?: Map<string, Awaited<ReturnType<typeof regionForPoint>>>
): Promise<boolean> {
  let data: { regionOnly: boolean; regionLabel?: string; regionLat?: number; regionLng?: number };

  if (!regionOnly) {
    data = { regionOnly: false };
  } else if (row.regionLabel && row.regionLat != null && row.regionLng != null) {
    data = { regionOnly: true };
  } else {
    const key = `${row.lat},${row.lng}`;
    let region = cache?.get(key);
    if (region === undefined) {
      region = await regionForPoint(row.lat, row.lng);
      cache?.set(key, region);
    }
    if (!region) return false;
    data = { regionOnly: true, regionLabel: region.placeLabel, regionLat: region.lat, regionLng: region.lng };
  }

  if (kind === "holding") {
    await prisma.pinHolding.update({ where: { id: row.id }, data });
  } else {
    await prisma.holdingCheckIn.update({ where: { id: row.id }, data });
  }
  return true;
}
