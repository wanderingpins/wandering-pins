// Builds an .xlsx with one row per pin: the code in column A, a high-res
// QR PNG in column B. Meant as a design asset export (copy the image cell
// straight into other software), not a print layout — see
// make-sticker-sheet.mjs for the true-size sticker sheet.
//
// The QR payload/version/ECC level here must match src/lib/qr.ts exactly,
// since these are the SAME already-minted codes, not new ones — mirrored
// rather than imported because that module is TypeScript and this is a
// plain .mjs script.
//
// Usage: node scripts/make-qr-table.mjs <batchDir> [outPath]
import ExcelJS from "exceljs";
import QRCode from "qrcode";
import { readFileSync } from "node:fs";
import path from "node:path";

const DOMAIN_PREFIX = "WWW.WPINS.CO/";
const ERROR_CORRECTION_LEVEL = "M";
const QR_VERSION = 1;
const PNG_WIDTH = 900; // px — well above 300ppi at any size a pin sticker would realistically be used

function buildQrPayload(slug) {
  return `${DOMAIN_PREFIX}${slug.toUpperCase()}`;
}

const batchDir = process.argv[2];
if (!batchDir) {
  console.error("Usage: make-qr-table.mjs <batchDir> [outPath]");
  process.exit(1);
}
const outPath = process.argv[3] ?? path.join(batchDir, "qr-table.xlsx");

const slugs = readFileSync(path.join(batchDir, "manifest.csv"), "utf8")
  .trim()
  .split("\n")
  .slice(1)
  .map((line) => line.split(",")[0]);

const workbook = new ExcelJS.Workbook();
const sheet = workbook.addWorksheet("QR Codes");
sheet.columns = [
  { header: "Code", key: "code", width: 16 },
  { header: "QR Code", key: "qr", width: 16 },
];
sheet.getRow(1).font = { bold: true };

const ROW_HEIGHT_PT = 72; // 1 inch tall rows, so the thumbnail reads clearly
const THUMB_PX = 90; // displayed size in-sheet; the embedded PNG itself stays at PNG_WIDTH

for (let i = 0; i < slugs.length; i++) {
  const slug = slugs[i];
  const rowNumber = i + 2;

  sheet.getCell(`A${rowNumber}`).value = slug;
  sheet.getCell(`A${rowNumber}`).alignment = { vertical: "middle", horizontal: "center" };
  sheet.getCell(`A${rowNumber}`).font = { name: "Consolas", size: 12 };
  sheet.getRow(rowNumber).height = ROW_HEIGHT_PT;

  const png = await QRCode.toBuffer(buildQrPayload(slug), {
    version: QR_VERSION,
    errorCorrectionLevel: ERROR_CORRECTION_LEVEL,
    type: "png",
    width: PNG_WIDTH,
  });

  const imageId = workbook.addImage({ buffer: png, extension: "png" });
  sheet.addImage(imageId, {
    tl: { col: 1, row: rowNumber - 1 },
    ext: { width: THUMB_PX, height: THUMB_PX },
  });

  if ((i + 1) % 50 === 0 || i + 1 === slugs.length) {
    console.log(`${i + 1}/${slugs.length}`);
  }
}

await workbook.xlsx.writeFile(outPath);
console.log(`Wrote ${outPath} — ${slugs.length} codes, ${PNG_WIDTH}px PNGs embedded`);
