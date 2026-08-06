import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { processHoldingPhoto } from "./image";

async function makeFakePhoto(width: number, height: number): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: { r: 200, g: 50, b: 50 } } })
    .jpeg()
    .withExifMerge({ IFD0: { Make: "TestCam" } })
    .toBuffer();
}

describe("processHoldingPhoto", () => {
  it("strips EXIF metadata", async () => {
    const raw = await makeFakePhoto(400, 300);
    expect((await sharp(raw).metadata()).exif).toBeDefined();

    const processed = await processHoldingPhoto(raw);
    expect((await sharp(processed).metadata()).exif).toBeUndefined();
  });

  it("leaves small images at their original size", async () => {
    const raw = await makeFakePhoto(400, 300);
    const processed = await processHoldingPhoto(raw);
    const meta = await sharp(processed).metadata();
    expect(meta.width).toBe(400);
    expect(meta.height).toBe(300);
  });

  it("downscales oversized images to fit within the max dimension", async () => {
    const raw = await makeFakePhoto(4000, 2000);
    const processed = await processHoldingPhoto(raw);
    const meta = await sharp(processed).metadata();
    expect(meta.width).toBeLessThanOrEqual(1600);
    expect(meta.height).toBeLessThanOrEqual(1600);
    // Aspect ratio preserved (2:1)
    expect(meta.width! / meta.height!).toBeCloseTo(2, 1);
  });

  it("outputs JPEG regardless of input format", async () => {
    const raw = await sharp({ create: { width: 100, height: 100, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 1 } } })
      .png()
      .toBuffer();
    const processed = await processHoldingPhoto(raw);
    expect((await sharp(processed).metadata()).format).toBe("jpeg");
  });
});
