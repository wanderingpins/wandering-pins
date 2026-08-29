import Link from "next/link";
import { getAuthClaims } from "@/lib/auth";
import { BEST_EFFORT_AUTH_TIMEOUT_MS } from "@/lib/with-timeout";

// Renders on every page via the root layout — a stalled auth check here
// stalls the entire site, not just protected pages, so this can't be left
// unbounded the way requireAppUser's own check is. Failing open to "signed
// out" costs nothing here: worst case the header briefly shows "Sign in"
// for someone who actually is, self-healing on the next request.
export async function SiteHeader() {
  const claims = await getAuthClaims(BEST_EFFORT_AUTH_TIMEOUT_MS);

  return (
    <header className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
      <Link href="/" className="text-sm font-semibold">
        Wandering Pins
      </Link>
      {claims ? (
        <div className="flex items-center gap-4">
          <Link href="/pins" className="text-sm font-medium text-neutral-700 hover:text-black">
            Browse pins
          </Link>
          <Link href="/series" className="text-sm font-medium text-neutral-700 hover:text-black">
            Series
          </Link>
          <Link href="/my-pins" className="text-sm font-medium text-neutral-700 hover:text-black">
            My pins
          </Link>
          <Link href="/settings" className="text-sm font-medium text-neutral-700 hover:text-black">
            Settings
          </Link>
          <form action="/auth/sign-out" method="post" className="flex items-center gap-3">
            <span className="text-sm text-neutral-600">{claims.email}</span>
            <button type="submit" className="text-sm font-medium text-neutral-700 hover:text-black">
              Sign out
            </button>
          </form>
        </div>
      ) : (
        <div className="flex items-center gap-4">
          <Link href="/pins" className="text-sm font-medium text-neutral-700 hover:text-black">
            Browse pins
          </Link>
          <Link href="/series" className="text-sm font-medium text-neutral-700 hover:text-black">
            Series
          </Link>
          <Link href="/sign-in" className="text-sm font-medium text-blue-600 hover:text-blue-700">
            Sign in
          </Link>
        </div>
      )}
    </header>
  );
}
