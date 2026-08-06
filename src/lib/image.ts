import sharp from "sharp";

const MAX_DIMENSION = 1600;

// Resizes and re-encodes as JPEG. Deliberately does NOT call
// .withMetadata() — sharp's default behaviour strips all EXIF/XMP/IPTC on
// output, which is the entire point (brief section 8: phone photos embed
// GPS, and photos are private in v1 but we still don't keep coordinates we
// promised not to expose).
export async function processHoldingPhoto(input: Buffer): Promise<Buffer> {
  return sharp(input)
    .rotate() // apply EXIF orientation before it gets stripped, so the image doesn't end up sideways
    .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();
}
