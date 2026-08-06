/**
 * wpins.co redirector logic — brief section 3.
 *
 * ZERO imports from the rest of this app, and none from Next.js either.
 * wpins.co is printed on physical stickers forever; this module must be
 * liftable verbatim into a standalone service (a Worker, a tiny Express app,
 * whatever) if the main app is ever rebuilt or rebranded. Plain strings in,
 * plain strings out.
 *
 * This is intentionally "dumb": it normalises casing/look-alikes and builds
 * the destination URL, but does NOT validate the check character or look
 * anything up in a database. Real validation (malformed vs. bad checksum vs.
 * unregistered) is application logic and belongs on the /p/[slug] page in
 * the main app, not in the redirector (gotcha #8 — don't let this grow
 * features).
 *
 * The slug alphabet/normalisation rules are duplicated from src/lib/slug.ts
 * on purpose, not shared, per the "zero imports" constraint above.
 */

const REDIRECTOR_HOSTS = new Set(["wpins.co", "www.wpins.co"]);
const APP_HOST = "wanderingpins.com";

export function isRedirectorHost(hostHeader: string): boolean {
  const bareHost = hostHeader.split(":")[0]?.toLowerCase() ?? "";
  return REDIRECTOR_HOSTS.has(bareHost);
}

function normalizeSlugInput(raw: string): string {
  return raw
    .replace(/[\s-]/g, "")
    .toUpperCase()
    .replace(/[IL]/g, "1")
    .replace(/O/g, "0");
}

// pathname is e.g. "/k7m2-qx9" (leading slash, as seen by an HTTP server).
export function buildRedirectUrl(pathname: string): string {
  const rawSlug = pathname.replace(/^\/+/, "");
  if (!rawSlug) {
    return `https://${APP_HOST}/`;
  }
  return `https://${APP_HOST}/p/${normalizeSlugInput(rawSlug)}`;
}
