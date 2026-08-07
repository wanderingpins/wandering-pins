// Builds a true-size sticker proof sheet from a mint-batch.ts output
// directory. Each sticker is 8.3mm x 13.9mm per the brief — the QR
// occupies the top 8.3mm-square block (the qrcode library's default
// 4-module quiet zone on a 21-module code means the full generated PNG,
// scaled to 8.3mm, puts the actual code at ~6mm, matching the brief's
// spec exactly). The remaining 5.6mm holds two lines of tiny text:
// "WPINS.CO" and the code.
//
// IMPORTANT: must be printed at 100% / actual size, not "fit to page", or
// the physical dimensions (and QR module size) will be wrong.
//
// Usage: node scripts/make-sticker-sheet.mjs <batchDir> [outPath]
import PDFDocument from "pdfkit";
import { createWriteStream, readFileSync } from "node:fs";
import path from "node:path";

const MM = 72 / 25.4; // points per mm

const batchDir = process.argv[2];
if (!batchDir) {
  console.error("Usage: make-sticker-sheet.mjs <batchDir> [outPath]");
  process.exit(1);
}
const outPath = process.argv[3] ?? path.join(batchDir, "sticker-proof-sheet.pdf");

const manifest = readFileSync(path.join(batchDir, "manifest.csv"), "utf8")
  .trim()
  .split("\n")
  .slice(1)
  .map((line) => {
    const [slug, filename] = line.split(",");
    return { slug, filename };
  });

const STICKER_W = 8.3 * MM;
const STICKER_H = 13.9 * MM;
const QR_SIZE = 8.3 * MM; // full PNG incl. quiet zone -> ~6mm code + margin
const LABEL_FONT_SIZE = 10;
const STICKER_FONT_SIZE = 4.4; // per brief: "someone reading 4.4pt type off a sticker"
const GAP_X = 18 * MM;
const COL_START_X = 20 * MM;
const ROW_Y = 90 * MM;
const LABEL_GAP = 6 * MM;

const doc = new PDFDocument({ size: "LETTER", margin: 0 });
doc.pipe(createWriteStream(outPath));

doc.fontSize(16).text("Wandering Pins — sticker proof sheet", 20 * MM, 15 * MM);
doc.fontSize(10).fillColor("#555").text(`Batch: ${path.basename(batchDir)}`, 20 * MM, 24 * MM);
doc.fontSize(9).fillColor("#c00").text('Print at 100% / actual size — do NOT use "fit to page".', 20 * MM, 30 * MM);
doc.fillColor("#000");

manifest.forEach((entry, i) => {
  const x = COL_START_X + i * GAP_X;

  // Human-readable label above the true-size mockup, for identification —
  // not part of the printed sticker itself.
  doc.fontSize(LABEL_FONT_SIZE).text(entry.slug, x - 10 * MM, ROW_Y - LABEL_GAP - LABEL_FONT_SIZE, {
    width: 20 * MM,
    align: "center",
  });

  // The actual sticker artwork, at true physical size.
  doc.rect(x, ROW_Y, STICKER_W, STICKER_H).lineWidth(0.25).strokeColor("#999").stroke();
  doc.image(path.join(batchDir, entry.filename), x, ROW_Y, { width: QR_SIZE, height: QR_SIZE });

  doc
    .fontSize(STICKER_FONT_SIZE)
    .fillColor("#000")
    .text("WPINS.CO", x, ROW_Y + QR_SIZE + 0.3 * MM, { width: STICKER_W, align: "center" });
  doc
    .fontSize(STICKER_FONT_SIZE)
    .text(entry.slug, x, ROW_Y + QR_SIZE + 0.3 * MM + STICKER_FONT_SIZE + 0.3, {
      width: STICKER_W,
      align: "center",
    });
});

doc.end();
console.log(`Wrote ${outPath}`);
