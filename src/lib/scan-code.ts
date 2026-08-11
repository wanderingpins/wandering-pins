// A scanned QR decodes to "WWW.WPINS.CO/{code}" (see src/lib/qr.ts), but this
// also accepts a bare code with no URL at all, since jsQR doesn't care what
// it decoded and a defensive fallback costs nothing.
export function extractCodeFromScan(raw: string): string {
  const trimmed = raw.trim();
  const withScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const path = new URL(withScheme).pathname.replace(/^\/+|\/+$/g, "");
    if (path) return path;
  } catch {
    // Not URL-shaped — fall through and treat the raw scan as the code itself.
  }
  return trimmed;
}
