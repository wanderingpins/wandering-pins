// Emits a companion SVG "cut lines" file per page of a sticker-sheet batch —
// just the per-sticker outline path (no QR, no text, no color), at the exact
// same grid coordinates as make-sticker-sheet.mjs — for import into
// Silhouette Studio as the vector cut layer, overlaid on a rasterized copy
// of the printed PDF page.
//
// All the layout math here is a straight mm-unit mirror of
// make-sticker-sheet.mjs's pt-based math (that script's `MM` conversion
// factor divided back out) — keep the two in sync if either changes.
//
// Usage: node scripts/make-cutlines.mjs <batchDir> [codeSizeMm=6] [outDir]
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const PAGE_W_MM = 215.9; // LETTER
const PAGE_H_MM = 279.4;

const batchDir = process.argv[2];
if (!batchDir) {
  console.error("Usage: make-cutlines.mjs <batchDir> [codeSizeMm=6] [outDir]");
  process.exit(1);
}
const CODE_SIZE_MM = process.argv[3] ? Number(process.argv[3]) : 6;
const outDir = process.argv[4] ?? batchDir;

const manifest = readFileSync(path.join(batchDir, "manifest.csv"), "utf8")
  .trim()
  .split("\n")
  .slice(1)
  .map((line) => {
    const [slug, filename] = line.split(",");
    return { slug, filename };
  });

const QUIET_ZONE_RATIO = 29 / 21;
const QR_SIZE = CODE_SIZE_MM * QUIET_ZONE_RATIO;
const STICKER_W = QR_SIZE;
const TEXT_BLOCK_H = 5.6;
const STICKER_H = QR_SIZE + TEXT_BLOCK_H;
const TOP_OFFSET = 2;
const ARCH_RADIUS = STICKER_W / 2;
const LABEL_FONT_SIZE_MM = (9 * 25.4) / 72; // pt -> mm, matches the PDF's 9pt label
const LABEL_GAP = 4 + ARCH_RADIUS;
const LABEL_TOP_OFFSET = LABEL_GAP + LABEL_FONT_SIZE_MM;
const CONTENT_BOTTOM_OFFSET = TOP_OFFSET + STICKER_H;

const MARGIN_LEFT = 20;
const MARGIN_RIGHT = 20;
const SIDE_GAP = 9.7;
const GAP_X = STICKER_W + SIDE_GAP;

const FIRST_ROW_Y = 48;
const BOTTOM_MARGIN = 8;
const ROW_CLEARANCE = 6;
const ROW_PITCH = CONTENT_BOTTOM_OFFSET + ROW_CLEARANCE + LABEL_TOP_OFFSET;

const usableWidth = PAGE_W_MM - MARGIN_LEFT - MARGIN_RIGHT - STICKER_W;
const COLS = Math.max(1, Math.floor(usableWidth / GAP_X) + 1);
const usableHeight = PAGE_H_MM - BOTTOM_MARGIN - FIRST_ROW_Y - CONTENT_BOTTOM_OFFSET;
const ROWS_PER_PAGE = Math.max(1, Math.floor(usableHeight / ROW_PITCH) + 1);
const PER_PAGE = COLS * ROWS_PER_PAGE;
const pageCount = Math.ceil(manifest.length / PER_PAGE);

// Same outline as drawSticker() in make-sticker-sheet.mjs: straight sides up
// to the top edge, a domed arc bulging upward, straight back down. SVG's
// y-down convention matches PDFKit's, so the coordinates carry over as-is;
// sweep-flag 1 is what makes the arc bulge toward -y (up) rather than down.
function stickerPath(x, rowY) {
  const archCenterX = x + STICKER_W / 2;
  const archLeftX = archCenterX - ARCH_RADIUS;
  const archRightX = archCenterX + ARCH_RADIUS;
  return [
    `M ${x} ${rowY + STICKER_H}`,
    `L ${x} ${rowY}`,
    `L ${archLeftX} ${rowY}`,
    `A ${ARCH_RADIUS} ${ARCH_RADIUS} 0 0 1 ${archRightX} ${rowY}`,
    `L ${x + STICKER_W} ${rowY}`,
    `L ${x + STICKER_W} ${rowY + STICKER_H}`,
    "Z",
  ].join(" ");
}

for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
  const pageEntries = manifest.slice(pageIndex * PER_PAGE, (pageIndex + 1) * PER_PAGE);
  const paths = pageEntries
    .map((entry, i) => {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const x = MARGIN_LEFT + col * GAP_X;
      const rowY = FIRST_ROW_Y + row * ROW_PITCH;
      return `  <path d="${stickerPath(x, rowY)}" fill="none" stroke="#000000" stroke-width="0.1"/>`;
    })
    .join("\n");

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${PAGE_W_MM}mm" height="${PAGE_H_MM}mm" viewBox="0 0 ${PAGE_W_MM} ${PAGE_H_MM}">
${paths}
</svg>
`;

  const outPath = path.join(outDir, `cutlines-page${pageIndex + 1}.svg`);
  writeFileSync(outPath, svg);
  console.log(`Wrote ${outPath} (${pageEntries.length} sticker outlines)`);
}

console.log(`Done: ${pageCount} page(s), matches make-sticker-sheet.mjs layout at ${CODE_SIZE_MM}mm code size.`);
