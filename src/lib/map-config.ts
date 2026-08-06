// Tile provider kept behind this one function (brief section 10: "Keep the
// provider behind one config value"). Swapping providers later means
// editing only this file.
export function getMapStyleUrl(): string {
  const key = process.env.NEXT_PUBLIC_MAPTILER_API_KEY;
  return `https://api.maptiler.com/maps/streets-v2/style.json?key=${key}`;
}
