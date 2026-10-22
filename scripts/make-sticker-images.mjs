// Renders one PNG per pin — QR code + "WPINS.CO" + code, no outline, no
// logo — matching the --plain layout of make-sticker-sheet.mjs, but as
// individual raster files instead of a print sheet. Meant for importing
// into design/cutting software (e.g. Silhouette Studio) that can select
// and drop in many image files at once but doesn't open a multi-sticker
// PDF as separate objects.
//
// QR payload/version/ECC must match src/lib/qr.ts exactly — mirrored, not
// imported, since that module is TypeScript and this is a plain .mjs
// script (same reasoning as make-qr-table.mjs).
//
// Usage: node scripts/make-sticker-images.mjs <batchDir> [codeSizeMm=6] [outDir]
import QRCode from "qrcode";
import sharp from "sharp";
import { readFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const DOMAIN_PREFIX = "WWW.WPINS.CO/";
const ERROR_CORRECTION_LEVEL = "M";
const QR_VERSION = 1;
// DPI to render+embed. Passing a `density` to sharp instead of baking exact
// pixel dimensions into the SVG double-applies the DPI scaling (a
// librsvg/sharp quirk when width/height carry a unit suffix alongside an
// explicit density) — confirmed by testing, so pixel counts below are
// computed by hand and written unitless onto the root <svg>.
const DPI = 1200;

function buildQrPayload(slug) {
  return `${DOMAIN_PREFIX}${slug.toUpperCase()}`;
}

const batchDir = process.argv[2];
if (!batchDir) {
  console.error("Usage: make-sticker-images.mjs <batchDir> [codeSizeMm=6] [outDir]");
  process.exit(1);
}
const CODE_SIZE_MM = process.argv[3] ? Number(process.argv[3]) : 6;
const outDir = process.argv[4] ?? path.join(batchDir, "images");
mkdirSync(outDir, { recursive: true });

const slugs = readFileSync(path.join(batchDir, "manifest.csv"), "utf8")
  .trim()
  .split("\n")
  .slice(1)
  .map((line) => line.split(",")[0]);

const MM_TO_PT = 72 / 25.4;
const QUIET_ZONE_RATIO = 29 / 21; // Version 1, default 4-module quiet zone each side
const QR_SIZE_PT = CODE_SIZE_MM * QUIET_ZONE_RATIO * MM_TO_PT;
const STICKER_W_PT = QR_SIZE_PT;
const TEXT_BLOCK_H_PT = 5.6 * MM_TO_PT;
const STICKER_H_PT = QR_SIZE_PT + TEXT_BLOCK_H_PT;
const FONT_SIZE_PT = 4.4;
const LINE_GAP_PT = 0.3 * MM_TO_PT;

// Target pixel dimensions, computed by hand (see DPI comment above) rather
// than left to sharp/librsvg's own unit conversion.
const OUT_W_PX = Math.round((STICKER_W_PT / 72) * DPI);
const OUT_H_PX = Math.round((STICKER_H_PT / 72) * DPI);

const COLOR_TEAL = "#3e9187";

function buildStickerSvg(qrInnerSvg, slug) {
  const line1Baseline = QR_SIZE_PT + LINE_GAP_PT + FONT_SIZE_PT * 0.85;
  const line2Baseline = line1Baseline + FONT_SIZE_PT + LINE_GAP_PT;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${OUT_W_PX}" height="${OUT_H_PX}" viewBox="0 0 ${STICKER_W_PT} ${STICKER_H_PT}">
  <rect width="100%" height="100%" fill="#ffffff"/>
  <g shape-rendering="crispEdges" transform="scale(${QR_SIZE_PT / 29})">${qrInnerSvg}</g>
  <text x="50%" y="${line1Baseline}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-weight="bold" font-size="${FONT_SIZE_PT}" fill="${COLOR_TEAL}">WPINS.CO</text>
  <text x="50%" y="${line2Baseline}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-weight="bold" font-size="${FONT_SIZE_PT}" fill="#000000">${slug}</text>
</svg>`;
}

for (let i = 0; i < slugs.length; i++) {
  const slug = slugs[i];
  const qrSvg = await QRCode.toString(buildQrPayload(slug), {
    type: "svg",
    version: QR_VERSION,
    errorCorrectionLevel: ERROR_CORRECTION_LEVEL,
  });
  const qrInner = qrSvg.replace(/^<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
  const svg = buildStickerSvg(qrInner, slug);

  await sharp(Buffer.from(svg))
    .png()
    .withMetadata({ density: DPI })
    .toFile(path.join(outDir, `${slug}.png`));

  if ((i + 1) % 50 === 0 || i + 1 === slugs.length) {
    console.log(`${i + 1}/${slugs.length}`);
  }
}

console.log(`Wrote ${slugs.length} PNGs to ${outDir}`);
