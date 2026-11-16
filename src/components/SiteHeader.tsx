import Link from "next/link";
import { HeaderLogo } from "@/components/HeaderLogo";
import { getAuthClaims, isAdminEmail } from "@/lib/auth";
import { BEST_EFFORT_AUTH_TIMEOUT_MS } from "@/lib/with-timeout";

// Nav links: big tap targets on a phone (a padded pill, base text), back to
// small text links from `sm` up where there's a mouse and room for one row.
const NAV_SHAPE =
  "rounded-full px-3 py-2 text-base font-medium hover:bg-neutral-100 sm:px-0 sm:py-0 sm:text-sm sm:hover:bg-transparent";
const NAV = `${NAV_SHAPE} text-neutral-700 hover:text-white`;

// Renders on every page via the root layout — a stalled auth check here
// stalls the entire site, not just protected pages, so this can't be left
// unbounded the way requireAppUser's own check is. Failing open to "signed
// out" costs nothing here: worst case the header briefly shows "Sign in"
// for someone who actually is, self-healing on the next request.
export async function SiteHeader() {
  const claims = await getAuthClaims(BEST_EFFORT_AUTH_TIMEOUT_MS);

  return (
    // On a phone the logo sits above the nav links (a single row got too long);
    // from `sm` up it's the usual logo-left, links-right bar.
    <header className="flex flex-col items-center gap-1 border-b border-neutral-200 px-4 py-1.5 sm:flex-row sm:justify-between">
      <HeaderLogo />
      {claims ? (
        <nav className="flex flex-wrap items-center justify-center gap-x-1 gap-y-1 pb-1 sm:gap-x-4 sm:pb-0">
          <Link href="/pins" className={NAV}>
            Browse pins
          </Link>
          <Link href="/series" className={NAV}>
            Series
          </Link>
          <Link href="/my-pins" className={NAV}>
            My pins
          </Link>
          <Link href="/settings" className={NAV}>
            Settings
          </Link>
          {isAdminEmail(claims.email) && (
            <Link href="/admin" className={NAV}>
              Admin
            </Link>
          )}
          <form action="/auth/sign-out" method="post" className="flex flex-wrap items-center justify-center gap-x-3">
            {/* The address takes a whole row on a phone; the button says enough. */}
            <span className="hidden text-sm text-neutral-600 md:inline">{claims.email}</span>
            <button type="submit" className={NAV}>
              Sign out
            </button>
          </form>
        </nav>
      ) : (
        <nav className="flex flex-wrap items-center justify-center gap-x-1 gap-y-1 pb-1 sm:gap-x-4 sm:pb-0">
          <Link href="/pins" className={NAV}>
            Browse pins
          </Link>
          <Link href="/series" className={NAV}>
            Series
          </Link>
          <Link href="/how-it-works" className={NAV}>
            How it works
          </Link>
          <Link href="/sign-in" className={`${NAV_SHAPE} text-accent hover:text-accent-hover`}>
            Sign in
          </Link>
        </nav>
      )}
    </header>
  );
}
