import { describe, expect, it } from "vitest";
import { computeOutputSize } from "./crop-photo";

describe("computeOutputSize", () => {
  it("leaves a crop that already fits untouched", () => {
    expect(computeOutputSize(800, 600, 1600)).toEqual({ width: 800, height: 600 });
  });

  it("never upscales", () => {
    expect(computeOutputSize(200, 200, 1600)).toEqual({ width: 200, height: 200 });
  });

  it("downscales the longest side to maxDimension, preserving aspect ratio", () => {
    expect(computeOutputSize(3200, 1600, 1600)).toEqual({ width: 1600, height: 800 });
    expect(computeOutputSize(1600, 3200, 1600)).toEqual({ width: 800, height: 1600 });
  });

  it("handles a square crop", () => {
    expect(computeOutputSize(4000, 4000, 1600)).toEqual({ width: 1600, height: 1600 });
  });
});
