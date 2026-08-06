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
  const url = `https://api.maptiler.com/geocoding/${encodeURIComponent(query)}.json?key=${key}&types=place&limit=1`;

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
