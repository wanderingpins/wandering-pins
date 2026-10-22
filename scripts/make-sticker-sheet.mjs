// Builds a true-size sticker sheet from a mint-batch.ts output directory,
// laid out as a grid (row-major) that auto-paginates if the batch is
// bigger than one LETTER page can hold. Settled design (per live testing):
// 6mm code size, dome radius = half the sticker width (flush with the
// sides, no lip), QR + text shifted 2mm below the top of the outline.
//
// Each sticker's QR occupies the top square block — the qrcode library's
// default 4-module quiet zone on a 21-module (Version 1) code means the
// actual scannable code is only 21/29 of the full rendered PNG, so QR_SIZE
// (the PNG's placed size) is back-solved from CODE_SIZE_MM. Sticker width
// matches QR_SIZE (no side margin), and a fixed 5.6mm block below holds
// two lines of tiny text: "WPINS.CO" and the code.
//
// The QR + text block sits TOP_OFFSET below the top of the sticker outline
// (a deliberate gap) — outline height is NOT enlarged to compensate, so
// the text intentionally runs past the bottom of the printed outline by
// TOP_OFFSET.
//
// IMPORTANT: must be printed at 100% / actual size, not "fit to page", or
// the physical dimensions (and QR module size) will be wrong.
//
// Usage: node scripts/make-sticker-sheet.mjs <batchDir> [codeSizeMm=6] [outPath] [--plain]
import PDFDocument from "pdfkit";
import { createWriteStream, readFileSync } from "node:fs";
import path from "node:path";

const MM = 72 / 25.4; // points per mm
const PAGE_W_MM = 215.9; // LETTER
const PAGE_H_MM = 279.4;

const args = process.argv.slice(2).filter((a) => a !== "--plain");
// --plain drops the domed outline and the "W"+"P" accent, leaving just the
// QR, "WPINS.CO", and the code — everything else (grid, spacing, page
// count) is unchanged, so a given batch still paginates the same way.
const PLAIN_STYLE = process.argv.includes("--plain");

const batchDir = args[0];
if (!batchDir) {
  console.error("Usage: make-sticker-sheet.mjs <batchDir> [codeSizeMm=6] [outPath] [--plain]");
  process.exit(1);
}
const CODE_SIZE_MM = args[1] ? Number(args[1]) : 6;
const outPath = args[2] ?? path.join(batchDir, PLAIN_STYLE ? "sticker-sheet-plain.pdf" : "sticker-sheet.pdf");

const manifest = readFileSync(path.join(batchDir, "manifest.csv"), "utf8")
  .trim()
  .split("\n")
  .slice(1)
  .map((line) => {
    const [slug, filename] = line.split(",");
    return { slug, filename };
  });

const QUIET_ZONE_RATIO = 29 / 21; // Version 1, default 4-module quiet zone each side
const QR_SIZE = CODE_SIZE_MM * QUIET_ZONE_RATIO * MM;
const STICKER_W = QR_SIZE;
const TEXT_BLOCK_H = 5.6 * MM; // two lines of STICKER_FONT_SIZE text, fixed regardless of QR size
const STICKER_H = QR_SIZE + TEXT_BLOCK_H;
const TOP_OFFSET = 2 * MM; // QR + text start this far below the outline's top edge
// Dome radius is exactly half the sticker width so the arc's endpoints land
// flush on the vertical sides — no flat "lip" where the dome meets the body.
const ARCH_RADIUS = STICKER_W / 2;
const LABEL_FONT_SIZE = 9; // small enough that even a wide 7-char slug (e.g. lots of W/M) stays on one line at 6mm code size
const STICKER_FONT_SIZE = 4.4; // per brief: "someone reading 4.4pt type off a sticker"
const LABEL_GAP = 4 * MM + ARCH_RADIUS;
const LABEL_TOP_OFFSET = LABEL_GAP + LABEL_FONT_SIZE;
const CONTENT_BOTTOM_OFFSET = TOP_OFFSET + STICKER_H;

// Brand palette (eyeballed off the "Wandering Pins" pin-lettering logo —
// nudge these to exact brand hex once a final logo file exists).
const COLOR_NAVY = "#17323f";
const COLOR_TEAL = "#3e9187";
const COLOR_ORANGE = "#dc7f3b";
const COLOR_GOLD = "#dfb23e";

const MARGIN_LEFT = 20 * MM;
const MARGIN_RIGHT = 20 * MM;
const SIDE_GAP = 9.7 * MM; // clearance between one sticker's right edge and the next's left edge
const GAP_X = STICKER_W + SIDE_GAP;

const FIRST_ROW_Y = 48 * MM; // leaves room for the page header above it
const BOTTOM_MARGIN = 8 * MM;
const ROW_CLEARANCE = 6 * MM; // gap between one row's lowest content and the next row's label
const ROW_PITCH = CONTENT_BOTTOM_OFFSET + ROW_CLEARANCE + LABEL_TOP_OFFSET;

const usableWidth = PAGE_W_MM * MM - MARGIN_LEFT - MARGIN_RIGHT - STICKER_W;
const COLS = Math.max(1, Math.floor(usableWidth / GAP_X) + 1);
const usableHeight = PAGE_H_MM * MM - BOTTOM_MARGIN - FIRST_ROW_Y - CONTENT_BOTTOM_OFFSET;
const ROWS_PER_PAGE = Math.max(1, Math.floor(usableHeight / ROW_PITCH) + 1);
const PER_PAGE = COLS * ROWS_PER_PAGE;
const pageCount = Math.ceil(manifest.length / PER_PAGE);

const doc = new PDFDocument({ size: "LETTER", margin: 0 });
doc.pipe(createWriteStream(outPath));

function drawHeader(pageIndex) {
  doc.fontSize(16).fillColor(COLOR_NAVY).text("Wandering Pins — sticker sheet", 20 * MM, 15 * MM);
  const pageNote = pageCount > 1 ? `  —  page ${pageIndex + 1} of ${pageCount}` : "";
  doc
    .fontSize(10)
    .fillColor("#555")
    .text(`Batch: ${path.basename(batchDir)}  —  ${manifest.length} pins  —  ${CODE_SIZE_MM}mm code${pageNote}`, 20 * MM, 24 * MM);
  doc.fontSize(9).fillColor("#c00").text('Print at 100% / actual size — do NOT use "fit to page".', 20 * MM, 30 * MM);
  doc.fillColor("#000");
}

// A single "P" drawn inside the sticker's domed cap, styled after the
// logo's enamel-pin lettering: bold fill, a gold outline stroke, a slight
// left tilt (like a pin sitting at a casual angle), and a barely-there
// shadow sliver for depth. Two earlier passes overshot in opposite
// directions — a 0.35mm offset with a dark shadow read as a letter
// floating above a heavy drop shadow, and thinning both offset and stroke
// to fix that then read as too flat/no outline — so this keeps the offset
// small (a "pushed in" sliver, not a hovering cast shadow) while bringing
// the outline back up to a visible weight.
const PIN_LETTER = "P";
const PIN_LETTER_FONT_SIZE = 8;
const PIN_LETTER_TILT_DEG = -6; // a few degrees left
const PIN_LETTER_FILL = COLOR_ORANGE;
const PIN_LETTER_OUTLINE = COLOR_GOLD;
const PIN_LETTER_SHADOW = "#b8752f"; // muted darker orange, for a light bevel
const PIN_LETTER_SHADOW_OFFSET = 0.1 * MM;

function drawPinLetter(cx, baselineY) {
  doc.font("Helvetica-Bold").fontSize(PIN_LETTER_FONT_SIZE);
  const w = doc.widthOfString(PIN_LETTER);
  const textHeight = doc.currentLineHeight();
  const x = cx - w / 2 - PIN_LETTER_SHADOW_OFFSET / 2;
  const topY = baselineY - textHeight;

  doc.save();
  doc.rotate(PIN_LETTER_TILT_DEG, { origin: [cx, baselineY] });

  doc.fillColor(PIN_LETTER_SHADOW).text(PIN_LETTER, x + PIN_LETTER_SHADOW_OFFSET, topY + PIN_LETTER_SHADOW_OFFSET, {
    lineBreak: false,
  });

  doc
    .fillColor(PIN_LETTER_FILL)
    .strokeColor(PIN_LETTER_OUTLINE)
    .lineWidth(0.4)
    .text(PIN_LETTER, x, topY, { lineBreak: false, fill: true, stroke: true });

  doc.restore();
  doc.fillColor("#000");
}

// A small flat "W" badge — a teal circle with a gold ring and a white
// letter, echoing the "WANDERING" pill from the logo (which is a flat
// enamel capsule, no shadow/bevel — unlike the "PINS" lettering, which is
// where the logo's 3D treatment lives). Sits just left of the "P".
const BADGE_RADIUS = 1.3 * MM;
const BADGE_FILL = COLOR_TEAL;
const BADGE_OUTLINE = COLOR_GOLD;
const BADGE_SHADOW = "#1f4b44"; // dark teal, cast behind/below the badge — not a fill gradient
const BADGE_SHADOW_OFFSET = 0.07 * MM; // just a sliver — 0.25mm read as a lot too much
const BADGE_LETTER = "W";
const BADGE_LETTER_FONT_SIZE = 5; // kept clear of the gold ring — 6pt (an earlier pass) touched it
const BADGE_LETTER_FILL = "#fdf6e8"; // warm off-white instead of stark white
const BADGE_LETTER_OUTLINE = "#245349"; // a shade darker than the badge teal, for a hairline of definition
const PIN_PAIR_GAP = 0.5 * MM;
// Baseline-aligning "W" and "P" exactly (equal parts) still read as "P too
// high": a capital P's ink is concentrated in its top bowl, while a "W"
// fills its full cap-height band edge to edge, so equal baselines don't
// look equal. Nudging the P down by this much is an optical correction,
// not a math one. A first pass at 0.5mm still read as too high.
const PIN_LETTER_OPTICAL_DROP = 1 * MM;

function drawWBadge(cx, cy) {
  // A solid dark circle cast down-right, peeking out from behind the
  // badge, reads as a badge sitting slightly proud of the sticker surface
  // — the same "shadow behind the shape" trick used for the "P", and
  // distinct from a fill gradient (which shades the disc's own face, not
  // the surface under it).
  doc.circle(cx + BADGE_SHADOW_OFFSET, cy + BADGE_SHADOW_OFFSET, BADGE_RADIUS).fill(BADGE_SHADOW);
  doc.circle(cx, cy, BADGE_RADIUS).fill(BADGE_FILL);
  doc.lineWidth(0.35).circle(cx, cy, BADGE_RADIUS).strokeColor(BADGE_OUTLINE).stroke();

  doc.font("Helvetica-Bold").fontSize(BADGE_LETTER_FONT_SIZE);
  const w = doc.widthOfString(BADGE_LETTER);
  // For Helvetica-Bold, ascender == capHeight, so a text box top of
  // (cy - capHeight/2) puts the glyph's actual cap-height box exactly
  // centered on cy — using currentLineHeight()/2 here (as a first pass
  // did) includes descender space the "W" never uses and read as
  // off-center.
  const capHeight = (doc._font.capHeight / 1000) * BADGE_LETTER_FONT_SIZE;
  const topY = cy - capHeight / 2;
  doc
    .fillColor(BADGE_LETTER_FILL)
    .strokeColor(BADGE_LETTER_OUTLINE)
    .lineWidth(0.15)
    .text(BADGE_LETTER, cx - w / 2, topY, { lineBreak: false, fill: true, stroke: true });
  doc.fillColor("#000");
}

// Draws the "W" badge and "P" letter as a centered pair — badge on the
// left, letter on the right — anchored near the dome's base (widest part).
function drawPinAccent(cx, baselineY) {
  doc.font("Helvetica-Bold").fontSize(PIN_LETTER_FONT_SIZE);
  const pWidth = doc.widthOfString(PIN_LETTER);
  const badgeDiameter = BADGE_RADIUS * 2;
  const totalWidth = badgeDiameter + PIN_PAIR_GAP + pWidth;
  const leftX = cx - totalWidth / 2;
  const badgeCx = leftX + BADGE_RADIUS;
  const pCx = leftX + badgeDiameter + PIN_PAIR_GAP + pWidth / 2;

  // The "W"'s own baseline sits at the shared reference line; the "P"
  // sits PIN_LETTER_OPTICAL_DROP below it (see constant above).
  const badgeLetterCapHeight = (doc._font.capHeight / 1000) * BADGE_LETTER_FONT_SIZE;
  const badgeCy = baselineY - badgeLetterCapHeight / 2;

  drawWBadge(badgeCx, badgeCy);
  drawPinLetter(pCx, baselineY + PIN_LETTER_OPTICAL_DROP);
}

function drawSticker(entry, x, rowY) {
  // Human-readable label above the true-size mockup, for identification —
  // not part of the printed sticker itself.
  doc.fontSize(LABEL_FONT_SIZE).fillColor("#000").text(entry.slug, x - 5 * MM, rowY - LABEL_GAP - LABEL_FONT_SIZE, {
    width: STICKER_W + 10 * MM,
    align: "center",
  });

  if (!PLAIN_STYLE) {
    // Outline: rectangle with a domed top — straight up the sides to the
    // top edge, a half-circle arc bulging upward, then straight back down.
    // QR + text are positioned independently below, per TOP_OFFSET.
    const archCenterX = x + STICKER_W / 2;
    const archLeftX = archCenterX - ARCH_RADIUS;
    // Note: pdfkit's .arc() issues its own internal moveTo, which starts a
    // new subpath — closePath() after it would close back to the arc's own
    // start point, not this shape's true start. Draw the bottom edge
    // explicitly instead of relying on closePath.
    doc
      .moveTo(x, rowY + STICKER_H)
      .lineTo(x, rowY)
      .lineTo(archLeftX, rowY)
      .arc(archCenterX, rowY, ARCH_RADIUS, Math.PI, 2 * Math.PI)
      .lineTo(x + STICKER_W, rowY)
      .lineTo(x + STICKER_W, rowY + STICKER_H)
      .lineTo(x, rowY + STICKER_H)
      .lineWidth(0.3)
      .strokeColor(COLOR_ORANGE)
      .stroke();

    // "W" badge + "P" letter inside the dome, anchored near its base (widest part).
    drawPinAccent(archCenterX, rowY - 0.6 * MM);
  }

  const contentY = rowY + TOP_OFFSET;
  doc.image(path.join(batchDir, entry.filename), x, contentY, { width: QR_SIZE, height: QR_SIZE });

  doc
    .fontSize(STICKER_FONT_SIZE)
    .fillColor(COLOR_TEAL)
    .text("WPINS.CO", x, contentY + QR_SIZE + 0.3 * MM, { width: STICKER_W, align: "center" });
  doc
    .fontSize(STICKER_FONT_SIZE)
    .fillColor("#000")
    .text(entry.slug, x, contentY + QR_SIZE + 0.3 * MM + STICKER_FONT_SIZE + 0.3, {
      width: STICKER_W,
      align: "center",
    });
}

for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
  if (pageIndex > 0) doc.addPage({ size: "LETTER", margin: 0 });
  drawHeader(pageIndex);

  const pageEntries = manifest.slice(pageIndex * PER_PAGE, (pageIndex + 1) * PER_PAGE);
  pageEntries.forEach((entry, i) => {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const x = MARGIN_LEFT + col * GAP_X;
    const rowY = FIRST_ROW_Y + row * ROW_PITCH;
    drawSticker(entry, x, rowY);
  });
}

doc.end();
console.log(`Wrote ${outPath}`);
console.log(`  ${manifest.length} pins, ${CODE_SIZE_MM}mm code, ${COLS} cols x up to ${ROWS_PER_PAGE} rows/page, ${pageCount} page(s)`);
