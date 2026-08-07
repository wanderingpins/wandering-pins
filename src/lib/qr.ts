import QRCode from "qrcode";

// Deliberate deviation from the original brief (which specified no scheme
// and no www to save characters): a real-device test found that Android's
// default Camera app does NOT reliably recognise a schemeless, non-www,
// all-caps string as a link — it falls back to a failed Google search of
// the literal text instead of offering to open it. Confirmed on-device
// that adding "WWW." fixes recognition, at the same physical/module size
// (still Version 1, just ECC M instead of Q to fit the extra 4 characters —
// see ERROR_CORRECTION_LEVEL below). "WWW.WPINS.CO/" is 13 chars; Version 1
// at ECC M holds 20 — exactly 7 left for the slug, still zero slack.
const DOMAIN_PREFIX = "WWW.WPINS.CO/";
const ERROR_CORRECTION_LEVEL = "M";

export function buildQrPayload(slug: string): string {
  return `${DOMAIN_PREFIX}${slug.toUpperCase()}`;
}

// Renders the sticker QR. version is forced to 1 — if the payload ever
// doesn't fit (a slug format change, a longer domain), this throws instead
// of silently producing a Version 2 code that stops scanning reliably at
// 6mm. Fail the build, not the sticker sheet.
export async function generatePinQrPng(slug: string): Promise<Buffer> {
  return QRCode.toBuffer(buildQrPayload(slug), {
    version: 1,
    errorCorrectionLevel: ERROR_CORRECTION_LEVEL,
    type: "png",
  });
}

// For tests: the version the library would pick on its own, with no
// version forced. If this ever drifts above 1, generatePinQrPng above will
// start throwing — this is the canary that explains why, before it does.
export function getRequiredQrVersion(slug: string): number {
  return QRCode.create(buildQrPayload(slug), { errorCorrectionLevel: ERROR_CORRECTION_LEVEL }).version;
}
