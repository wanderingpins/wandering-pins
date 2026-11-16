import { describe, expect, it } from "vitest";
import {
  JOURNAL_TRAIL_VARIANTS,
  PIN_PILL_COLORS,
  PIN_PUSHPIN_COLORS,
  PIN_STICKER_COLORS,
  journalEntryStyle,
  journalPhotoTilt,
  pinCardStyle,
} from "./pin-card-style";

const SLUGS = ["1EKWD4F", "XHQFYGA", "TQH8CXQ", "XR37YG3", "B2B2B2B", "C3C3C3C", "D4D4D4D", "E5E5E5E", "F6F6F6F", "G7G7G7G"];

describe("pinCardStyle", () => {
  it("is deterministic for a given slug", () => {
    expect(pinCardStyle("1EKWD4F")).toEqual(pinCardStyle("1EKWD4F"));
  });

  it("only ever picks a palette color", () => {
    for (const slug of [...SLUGS, "A", ""]) {
      expect(PIN_PILL_COLORS).toContain(pinCardStyle(slug).color);
    }
  });

  it("keeps both tilts within -5 to +5 degrees", () => {
    for (const slug of [...SLUGS, "A", ""]) {
      const { photoTilt, paperTilt } = pinCardStyle(slug);
      expect(Math.abs(photoTilt)).toBeLessThanOrEqual(5);
      expect(Math.abs(paperTilt)).toBeLessThanOrEqual(5);
    }
  });

  it("leans both ways rather than all the same direction", () => {
    const photo = SLUGS.map((s) => pinCardStyle(s).photoTilt);
    const paper = SLUGS.map((s) => pinCardStyle(s).paperTilt);
    for (const tilts of [photo, paper]) {
      expect(tilts.some((t) => t > 0)).toBe(true);
      expect(tilts.some((t) => t < 0)).toBe(true);
      expect(new Set(tilts).size).toBeGreaterThan(SLUGS.length / 2);
    }
  });

  it("tilts the photo and the note independently", () => {
    const same = SLUGS.filter((s) => {
      const { photoTilt, paperTilt } = pinCardStyle(s);
      return photoTilt === paperTilt;
    });
    expect(same.length).toBeLessThan(SLUGS.length / 2);
  });

  it("uses more than one color across different slugs", () => {
    expect(new Set(SLUGS.map((s) => pinCardStyle(s).color)).size).toBeGreaterThan(1);
  });

  it("picks the sticker from its own palette, in a variety of colors", () => {
    for (const slug of [...SLUGS, "A", ""]) {
      expect(PIN_STICKER_COLORS).toContain(pinCardStyle(slug).stickerColor);
    }
    expect(new Set(SLUGS.map((s) => pinCardStyle(s).stickerColor)).size).toBeGreaterThan(3);
  });

  it("picks push pin colors from the palette", () => {
    for (const slug of [...SLUGS, "A", ""]) {
      const { photoPinColor, paperPinColor } = pinCardStyle(slug);
      expect(PIN_PUSHPIN_COLORS).toContain(photoPinColor);
      expect(PIN_PUSHPIN_COLORS).toContain(paperPinColor);
    }
  });

  it("never gives the note the same push pin color as the photo", () => {
    for (let i = 0; i < 500; i++) {
      const { photoPinColor, paperPinColor } = pinCardStyle(`SLUG${i}`);
      expect(paperPinColor).not.toBe(photoPinColor);
    }
  });

  it("varies push pin colors across pins", () => {
    expect(new Set(SLUGS.map((s) => pinCardStyle(s).photoPinColor)).size).toBeGreaterThan(2);
    expect(new Set(SLUGS.map((s) => pinCardStyle(s).paperPinColor)).size).toBeGreaterThan(2);
  });

  it("slaps the sticker on crooked, within -12 to +12 degrees, leaning both ways", () => {
    const tilts = SLUGS.map((s) => pinCardStyle(s).stickerTilt);
    for (const t of tilts) expect(Math.abs(t)).toBeLessThanOrEqual(12);
    expect(tilts.some((t) => t > 0)).toBe(true);
    expect(tilts.some((t) => t < 0)).toBe(true);
  });
});

const KEYS = SLUGS.map((s, i) => (i % 2 ? `holding-${s}` : `checkin-${s}`));

describe("journalEntryStyle", () => {
  it("is deterministic and only picks palette colors", () => {
    for (const key of KEYS) {
      const style = journalEntryStyle(key);
      expect(journalEntryStyle(key)).toEqual(style);
      expect(PIN_STICKER_COLORS).toContain(style.stickerColor);
      expect(PIN_PUSHPIN_COLORS).toContain(style.pinColor);
      expect(style.trailVariant).toBeGreaterThanOrEqual(0);
      expect(style.trailVariant).toBeLessThan(JOURNAL_TRAIL_VARIANTS);
    }
  });

  it("keeps stickers within 4 degrees and pages within 1, varying across entries", () => {
    const styles = KEYS.map(journalEntryStyle);
    for (const s of styles) {
      expect(Math.abs(s.stickerTilt)).toBeLessThanOrEqual(4 + 1e-9);
      expect(Math.abs(s.pageTilt)).toBeLessThanOrEqual(1 + 1e-9);
    }
    expect(new Set(styles.map((s) => s.stickerColor)).size).toBeGreaterThan(2);
    expect(new Set(styles.map((s) => s.stickerTilt)).size).toBeGreaterThan(2);
  });
});

describe("journalPhotoTilt", () => {
  it("is deterministic, within -5 to +5, and leans both ways", () => {
    const tilts = KEYS.map(journalPhotoTilt);
    expect(KEYS.map(journalPhotoTilt)).toEqual(tilts);
    for (const t of tilts) expect(Math.abs(t)).toBeLessThanOrEqual(5 + 1e-9);
    expect(tilts.some((t) => t > 0)).toBe(true);
    expect(tilts.some((t) => t < 0)).toBe(true);
  });
});
