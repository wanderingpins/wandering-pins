import { NextResponse, type NextRequest } from "next/server";
import { buildRedirectUrl, isRedirectorHost } from "@/wpins-redirect";
import { normalizeSlugInput } from "@/lib/slug";
import { exchangeStrayAuthCode, updateSession } from "@/lib/supabase/proxy";
import { getClientIp, isRateLimited } from "@/lib/rate-limit";

const PIN_PATH = /^\/p\/([^/]+)$/;

// Host-header branch between wpins.co (dumb redirector, brief section 3) and
// wanderingpins.com (the real app). 302, not 301 — see brief section 3 for
// why (a 301 would be cached forever and we'd lose the ability to repoint a
// code if a sticker batch ever needs it).
export async function proxy(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  if (isRedirectorHost(host)) {
    return NextResponse.redirect(buildRedirectUrl(request.nextUrl.pathname), 302);
  }

  // Supabase's actual confirmation flow lands a PKCE `code` on the Site URL
  // directly rather than on /auth/confirm (see exchangeStrayAuthCode) — skip
  // this on /auth/confirm itself so its own route handler manages that case.
  if (request.nextUrl.pathname !== "/auth/confirm") {
    const strayCodeResponse = await exchangeStrayAuthCode(request);
    if (strayCodeResponse) return strayCodeResponse;
  }

  // Canonicalisation on the app itself (brief section 4): someone can land
  // on /p/{slug} directly (typed, bookmarked, shared) without going through
  // wpins.co. If casing/look-alikes differ from the canonical form, fix the
  // address bar rather than silently resolving.
  const match = request.nextUrl.pathname.match(PIN_PATH);
  if (match) {
    const normalized = normalizeSlugInput(match[1]);
    if (normalized !== match[1]) {
      return NextResponse.redirect(new URL(`/p/${normalized}`, request.url), 302);
    }

    // Compensating control for the check-digit spending a character on
    // error detection rather than entropy (brief section 8) — a ~1B
    // keyspace is otherwise scrapeable by sequential/random guessing.
    if (await isRateLimited(getClientIp(request.headers))) {
      return new NextResponse("Too many requests — please slow down and try again in a minute.", {
        status: 429,
        headers: { "Content-Type": "text/plain", "Retry-After": "60" },
      });
    }
  }

  return updateSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
