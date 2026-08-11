import { MAX_PHOTO_DIMENSION, TARGET_UPLOAD_BYTES } from "@/lib/photo-limits";

export type PixelCrop = { x: number; y: number; width: number; height: number };

// Pure and unit-testable: scales a crop rectangle down (never up) so its
// longest side fits maxDimension, preserving aspect ratio.
export function computeOutputSize(
  width: number,
  height: number,
  maxDimension: number
): { width: number; height: number } {
  const scale = Math.min(1, maxDimension / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Couldn't load that photo."));
    image.src = src;
  });
}

function canvasToJpegBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Couldn't export the cropped photo."))),
      "image/jpeg",
      quality
    );
  });
}

// Crops imageSrc to cropPixels, downscales to MAX_PHOTO_DIMENSION, and
// re-encodes as JPEG — stepping quality down until the result fits
// TARGET_UPLOAD_BYTES (or bottoms out), so the upload itself is already
// small rather than relying only on the server-side pass.
export async function cropPhotoToBlob(imageSrc: string, cropPixels: PixelCrop): Promise<Blob> {
  const image = await loadImage(imageSrc);
  const { width: outputWidth, height: outputHeight } = computeOutputSize(
    cropPixels.width,
    cropPixels.height,
    MAX_PHOTO_DIMENSION
  );

  const canvas = document.createElement("canvas");
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Photo cropping isn't supported on this browser.");
  context.drawImage(
    image,
    cropPixels.x,
    cropPixels.y,
    cropPixels.width,
    cropPixels.height,
    0,
    0,
    outputWidth,
    outputHeight
  );

  let quality = 0.9;
  let blob = await canvasToJpegBlob(canvas, quality);
  while (blob.size > TARGET_UPLOAD_BYTES && quality > 0.5) {
    quality -= 0.1;
    blob = await canvasToJpegBlob(canvas, quality);
  }
  return blob;
}
