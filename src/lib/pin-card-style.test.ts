import { describe, expect, it } from "vitest";
import { PIN_PILL_COLORS, PIN_PUSHPIN_COLORS, PIN_STICKER_COLORS, pinCardStyle } from "./pin-card-style";

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
