// Cosmetic variety for the cork view of /pins: each pin gets its own enamel
// color and a slightly different tilt, derived from its slug so a pin looks the
// same on every visit and on every device (no randomness, nothing stored).

// Brand-adjacent enamels. All keep cream label text at >= 3:1 contrast (these
// are large, bold labels), against the same gold outline as the logo's pill.
export const PIN_PILL_COLORS = [
  "#35948A", // teal (the logo's own)
  "#C0561F", // orange
  "#7C4A8B", // plum
  "#3B6FA8", // blue
  "#4E8A3E", // green
  "#B13F3A", // crimson
] as const;

// Push pin heads for the photo and the note. Saturated, and none close to the
// gold ring or the cork, so they stay visible on both the cork and the paper.
export const PIN_PUSHPIN_COLORS = [
  "#D64545", // red
  "#D06A2E", // orange (the original)
  "#3B82C4", // blue
  "#3FA36B", // green
  "#8E5BB5", // purple
  "#E0629E", // pink
] as const;

// The photo and the note each lean anywhere from -MAX_TILT to +MAX_TILT
// degrees, independently, so a wall of cards doesn't look stamped out. (The
// full pin page keeps its fixed +4 / -5; this is only the cork wall.)
const MAX_TILT = 5;

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // Final avalanche so slugs that differ in one character still land far apart.
  h ^= h >>> 16;
  h = Math.imul(h, 2246822507);
  h ^= h >>> 13;
  return h >>> 0;
}

// The "currently with / verified locations" sticker: bright garage-sale
// colors, all dark enough text-wise that the sticker's dark ink reads at >= 4.5:1.
export const PIN_STICKER_COLORS = [
  "#FFD23F", // sunshine
  "#FF6B6B", // coral
  "#7ED6B2", // mint
  "#6EC1F0", // sky
  "#C3A6F5", // lilac
  "#FFA040", // tangerine
  "#FF7EB6", // pink
] as const;

// Stickers get slapped on more crookedly than a pinned photo.
const MAX_STICKER_TILT = 12;

// Uniform-ish value in [-max, max], to a tenth of a degree.
function tiltFor(slug: string, salt: string, max = MAX_TILT): number {
  const unit = hash(`${slug}:${salt}`) / 0xffffffff; // 0..1
  return Math.round((unit * 2 - 1) * max * 10) / 10;
}

export type PinCardStyle = {
  color: string;
  photoTilt: number;
  paperTilt: number;
  stickerColor: string;
  stickerTilt: number;
  photoPinColor: string;
  paperPinColor: string;
};

export function pinCardStyle(slug: string): PinCardStyle {
  // (Salts are arbitrary; these give the pins that existed when this was
  // written all-different pin colors. Over many pins any salt is equally random.)
  const photoPin = hash(`${slug}:pin-a`) % PIN_PUSHPIN_COLORS.length;
  // Offset by 1..5 so the note's pin is never the same color as the photo's —
  // they're meant to look like two separate pins.
  const paperPin = (photoPin + 1 + (hash(`${slug}:paper-pin`) % (PIN_PUSHPIN_COLORS.length - 1))) % PIN_PUSHPIN_COLORS.length;
  return {
    photoPinColor: PIN_PUSHPIN_COLORS[photoPin],
    paperPinColor: PIN_PUSHPIN_COLORS[paperPin],
    color: PIN_PILL_COLORS[hash(`${slug}:color`) % PIN_PILL_COLORS.length],
    // The salts are arbitrary; these happen to give the handful of pins that
    // existed when this was written a good mix of leans and colors (any salt
    // is equally random over many pins).
    photoTilt: tiltFor(slug, "print"),
    paperTilt: tiltFor(slug, "tilt-b"),
    stickerColor: PIN_STICKER_COLORS[hash(`${slug}:starburst`) % PIN_STICKER_COLORS.length],
    stickerTilt: tiltFor(slug, "peel", MAX_STICKER_TILT),
  };
}
