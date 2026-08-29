import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { withTimeout, AUTH_CALL_TIMEOUT_MS } from "@/lib/with-timeout";

// Handles both link shapes Supabase can send: the PKCE `code` param
// (exchangeCodeForSession — this project's default confirmation flow) and
// the `token_hash`+`type` param (verifyOtp — used if the email template is
// customised to send a token hash instead). Note: Supabase's default
// confirmation flow actually routes through its own /auth/v1/verify first,
// which lands the `code` on the Site URL rather than here — see
// exchangeStrayAuthCode in src/lib/supabase/proxy.ts for that path. This
// route still handles a `code` directly in case that ever changes.
//
// Builds the redirect response explicitly and attaches cookies directly to
// it, rather than going through next/headers' cookies() + redirect() (which
// throws internally) — a session large enough to chunk across multiple
// sb-* cookies needs every chunk's Set-Cookie header to land on the same
// response object, which the throw-based path doesn't guarantee.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/";

  const errorUrl = new URL("/auth/error", request.url);
  const nextUrl = new URL(next, request.url);
  let response = NextResponse.redirect(nextUrl);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Rebuild the response fresh each call (there's only ever one
          // call, with the full chunk list) so every chunk attaches to the
          // same object we ultimately return.
          response = NextResponse.redirect(nextUrl);
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  const result = code
    ? await withTimeout(supabase.auth.exchangeCodeForSession(code), AUTH_CALL_TIMEOUT_MS)
    : tokenHash && type
      ? await withTimeout(supabase.auth.verifyOtp({ type, token_hash: tokenHash }), AUTH_CALL_TIMEOUT_MS)
      : { error: new Error("missing code or token_hash") };

  if (result === "timeout") {
    console.error(`auth confirm timed out after ${AUTH_CALL_TIMEOUT_MS}ms`);
    return NextResponse.redirect(errorUrl);
  }
  if (result.error) {
    console.error("auth confirm failed", { message: result.error.message });
    return NextResponse.redirect(errorUrl);
  }

  return response;
}
