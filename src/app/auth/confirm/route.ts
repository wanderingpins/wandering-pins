import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

// Handles both link shapes Supabase can send: the PKCE `code` param
// (exchangeCodeForSession — this project's actual default, confirmed by
// testing a real magic link) and the `token_hash`+`type` param (verifyOtp —
// used if the email template is customised to send a token hash instead).
//
// Builds the redirect response explicitly and attaches cookies directly to
// it, rather than going through next/headers' cookies() + redirect() (which
// throws internally). A large session gets chunked across multiple sb-*
// cookies, and this project's sessions are big enough to need it — the
// throw-based path was never proven to flush more than one queued
// Set-Cookie header before being caught, only ever tested with a single
// unchunked cookie. This mirrors the pattern already proven to work in
// src/lib/supabase/proxy.ts.
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

  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash && type
      ? await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
      : { error: new Error("missing code or token_hash") };

  if (error) {
    console.error("auth confirm failed", { message: error.message });
    return NextResponse.redirect(errorUrl);
  }

  return response;
}
