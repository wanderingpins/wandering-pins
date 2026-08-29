const EARTH_RADIUS_KM = 6371;

// Great-circle distance between two lat/lng points, in kilometers.
export function haversineDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}

// Generous on purpose — city-level geocoding can legitimately be tens of km
// off from a specific spot (see geocode.ts), and this is an honesty nudge
// (not tamper-proof — devtools/GPS-spoofing can fake it), not a precise
// geofence. See verifyHoldingLocation/verifyCheckInLocation for how this
// is used.
export const VERIFY_TOLERANCE_KM = 50;
