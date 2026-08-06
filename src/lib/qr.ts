import QRCode from "qrcode";

// Brief section 9: encode exactly this, uppercase, no scheme, no www.
// "WPINS.CO/" is 9 chars; Version 1 at ECC Q holds 16 — exactly 7 left for
// the slug. There is no slack, which is why version is forced below rather
// than left to auto-select.
const DOMAIN_PREFIX = "WPINS.CO/";

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
    errorCorrectionLevel: "Q",
    type: "png",
  });
}

// For tests: the version the library would pick on its own, with no
// version forced. If this ever drifts above 1, generatePinQrPng above will
// start throwing — this is the canary that explains why, before it does.
export function getRequiredQrVersion(slug: string): number {
  return QRCode.create(buildQrPayload(slug), { errorCorrectionLevel: "Q" }).version;
}
