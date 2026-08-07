import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

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
  // isn't guaranteed to revalidate the token.
  await supabase.auth.getClaims();

  return supabaseResponse;
}

// Supabase's actual Magic Link template (confirmed against a real sent
// email — a dashboard template edit intended to switch this to the
// token_hash flow apparently never saved) sends users through Supabase's
// own /auth/v1/verify, which lands the PKCE `code` directly on the Site URL
// — this project's homepage — not on /auth/confirm. Rather than depend on
// that dashboard edit, handle a stray `code` wherever it lands.
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

  const { error } = await supabase.auth.exchangeCodeForSession(code!);
  if (error) {
    console.error("stray code exchange failed", { message: error.message });
    return NextResponse.redirect(new URL("/auth/error", request.url));
  }
  return response;
}
