import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { withTimeout, AUTH_CALL_TIMEOUT_MS } from "@/lib/with-timeout";

// getClaims() only makes a network call when the token needs refreshing
// (expired access token, or a cold instance with no cached JWKS yet) — but
// when Supabase's own Auth/API Gateway is degraded, that call can hang far
// longer than a normal page load should ever take, and this middleware runs
// on every request site-wide, not just signed-in ones. Capping it means a
// slow Auth provider costs one skipped session refresh instead of stalling
// every visitor's every click. Deliberately shorter than AUTH_CALL_TIMEOUT_MS
// below — this one fails silently (skip the refresh), so it can afford to
// be stricter than a call whose timeout is user-visible.
const GET_CLAIMS_TIMEOUT_MS = 3000;

// Refreshes the Supabase Auth session on every request and keeps the
// refreshed cookies in sync between the incoming request (so Server
// Components don't redundantly refresh) and the outgoing response (so the
// browser gets the new token). Returns the response the caller should return.
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getClaims() validates the JWT locally against the project's published
  // keys and refreshes it if expired — never use getSession() here, it
  // isn't guaranteed to revalidate the token. If it times out, this request
  // just skips the refresh (fail closed — no cookies get touched here, and
  // the real session cookie is untouched, so the next request tries again
  // normally); it does NOT log anyone out, it only means this one request
  // didn't proactively renew the token.
  const result = await withTimeout(supabase.auth.getClaims(), GET_CLAIMS_TIMEOUT_MS);
  if (result === "timeout") {
    console.error(`getClaims timed out after ${GET_CLAIMS_TIMEOUT_MS}ms — skipping session refresh for this request`);
  }

  return supabaseResponse;
}

// The default Magic Link template routes through Supabase's own
// /auth/v1/verify, which lands the PKCE `code` (or an error) directly on
// the Site URL — this project's homepage — rather than on /auth/confirm.
// That behavior depends on dashboard email-template configuration rather
// than anything this app controls, so handle a stray `code`/`error`
// wherever it shows up instead of assuming a specific template is active.
export async function exchangeStrayAuthCode(request: NextRequest): Promise<NextResponse | null> {
  const code = request.nextUrl.searchParams.get("code");
  const authError = request.nextUrl.searchParams.get("error");
  if (!code && !authError) return null;

  const cleanUrl = new URL(request.nextUrl);
  cleanUrl.search = "";

  if (authError) {
    console.error("stray auth error param", { error: authError, description: request.nextUrl.searchParams.get("error_description") });
    return NextResponse.redirect(new URL("/auth/error", request.url));
  }

  let response = NextResponse.redirect(cleanUrl);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          response = NextResponse.redirect(cleanUrl);
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  const result = await withTimeout(supabase.auth.exchangeCodeForSession(code!), AUTH_CALL_TIMEOUT_MS);
  if (result === "timeout") {
    console.error(`exchangeCodeForSession timed out after ${AUTH_CALL_TIMEOUT_MS}ms`);
    return NextResponse.redirect(new URL("/auth/error", request.url));
  }
  if (result.error) {
    console.error("stray code exchange failed", { message: result.error.message });
    return NextResponse.redirect(new URL("/auth/error", request.url));
  }
  return response;
}
