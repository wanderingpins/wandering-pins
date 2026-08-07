import { describe, expect, it } from "vitest";
import { buildQrPayload, generatePinQrPng, getRequiredQrVersion } from "./qr";
import { generateSlug } from "./slug";

describe("buildQrPayload", () => {
  // WWW. prefix is a deliberate deviation from the brief's original
  // no-www spec — see comment in qr.ts for why.
  it("includes the www prefix", () => {
    expect(buildQrPayload("K7M2QX9")).toBe("WWW.WPINS.CO/K7M2QX9");
  });

  it("uppercases the slug", () => {
    expect(buildQrPayload("k7m2qx9")).toBe("WWW.WPINS.CO/K7M2QX9");
  });
});

describe("getRequiredQrVersion", () => {
  it("stays at Version 1 for the worked example and 1000 random slugs", () => {
    expect(getRequiredQrVersion("K7M2QX9")).toBe(1);
    for (let i = 0; i < 1000; i++) {
      expect(getRequiredQrVersion(generateSlug())).toBe(1);
    }
  });
});

describe("generatePinQrPng", () => {
  it("produces a valid PNG buffer", async () => {
    const png = await generatePinQrPng(generateSlug());
    expect(png.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  });

  it("throws rather than silently upgrading if content ever overflows Version 1", async () => {
    // Simulate a slug format change that no longer fits — proves the "fail
    // the build" behavior actually fires instead of just being assumed.
    await expect(generatePinQrPng("WAYTOOLONGOFASLUGFORTHISQRVERSION")).rejects.toThrow();
  });
});
