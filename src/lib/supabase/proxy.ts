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
