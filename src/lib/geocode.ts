// Forward-geocodes a typed place name to a city centroid (brief section 10).
// Reuses the MapTiler account we already need for map tiles, kept behind
// this one function the same way map-config.ts keeps the tile provider
// behind one function — swap providers by editing just this file.
export type GeocodedPlace = {
  placeLabel: string;
  lat: number;
  lng: number;
};

// Round to ~1.1km — plenty coarse for a "city" and defensive even though
// city-level geocoding results are already centroids, not precise addresses.
function roundCoarse(n: number): number {
  return Math.round(n * 100) / 100;
}

export async function geocodePlace(query: string): Promise<GeocodedPlace | null> {
  const key = process.env.NEXT_PUBLIC_MAPTILER_API_KEY;
  // types=place alone silently misses any US "consolidated city-county"
  // (Denver, San Francisco, Nashville, ...) — MapTiler tags those as
  // `county`, not `place`, so a query for one of them would otherwise match
  // whatever same-named suburb or hamlet elsewhere in the world happens to
  // carry the `place` tag instead of the actual well-known city.
  const url = `https://api.maptiler.com/geocoding/${encodeURIComponent(query)}.json?key=${key}&types=place,municipality,county,locality&limit=1`;

  const res = await fetch(url);
  if (!res.ok) return null;

  const body = await res.json();
  const feature = body.features?.[0];
  if (!feature) return null;

  const [lng, lat] = feature.center;
  return {
    placeLabel: feature.place_name ?? query,
    lat: roundCoarse(lat),
    lng: roundCoarse(lng),
  };
}

// The state/region a point sits in, for "Only show the state" (see
// PinHolding.regionOnly): reverse-geocodes the stored town centroid and keeps
// the region feature ("California, United States", "England, United Kingdom"),
// or the country where there's no region level (Luxembourg). Its own centroid
// is what goes on the public map, so the town's position never does.
export async function regionForPoint(lat: number, lng: number): Promise<GeocodedPlace | null> {
  const key = process.env.NEXT_PUBLIC_MAPTILER_API_KEY;
  const url = `https://api.maptiler.com/geocoding/${lng},${lat}.json?key=${key}`;

  const res = await fetch(url);
  if (!res.ok) return null;

  const body = await res.json();
  const features: { id?: string; place_name?: string; center?: [number, number] }[] = body.features ?? [];
  const feature =
    features.find((f) => f.id?.startsWith("region.")) ?? features.find((f) => f.id?.startsWith("country."));
  if (!feature?.place_name || !feature.center) return null;

  const [rLng, rLat] = feature.center;
  return { placeLabel: feature.place_name, lat: roundCoarse(rLat), lng: roundCoarse(rLng) };
}

// The region columns to store alongside a place (PinHolding / HoldingCheckIn).
// Only looks the region up when it's wanted; if the lookup fails, the place
// is saved as the town with regionOnly false, so `ok: false` tells the caller
// to warn rather than silently publishing the town.
export async function regionFieldsFor(
  place: { lat: number; lng: number },
  regionOnly: boolean
): Promise<
  | { ok: true; fields: { regionOnly: boolean; regionLabel: string | null; regionLat: number | null; regionLng: number | null } }
  | { ok: false }
> {
  if (!regionOnly) return { ok: true, fields: { regionOnly: false, regionLabel: null, regionLat: null, regionLng: null } };
  const region = await regionForPoint(place.lat, place.lng);
  if (!region) return { ok: false };
  return {
    ok: true,
    fields: { regionOnly: true, regionLabel: region.placeLabel, regionLat: region.lat, regionLng: region.lng },
  };
}
