import Link from "next/link";
import { getAuthClaims } from "@/lib/auth";

export async function SiteHeader() {
  const claims = await getAuthClaims();

  return (
    <header className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
      <Link href="/" className="text-sm font-semibold">
        Wandering Pins
      </Link>
      {claims ? (
        <div className="flex items-center gap-4">
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
        <Link href="/sign-in" className="text-sm font-medium text-blue-600 hover:text-blue-700">
          Sign in
        </Link>
      )}
    </header>
  );
}
