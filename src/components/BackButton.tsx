"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

const SEEN_KEY = "wp-pages-seen";

// Mounted once in the root layout: counts the pages this browser tab has
// shown on this site, so BackButton can tell "came here from our own pages"
// from "landed here from a scanned sticker or a shared link". sessionStorage
// is per tab, which is exactly the scope of the Back history.
export function NavTracker() {
  const pathname = usePathname();
  useEffect(() => {
    try {
      const seen = Number(sessionStorage.getItem(SEEN_KEY) ?? "0");
      sessionStorage.setItem(SEEN_KEY, String(seen + 1));
    } catch {
      // Storage blocked: BackButton just falls back to its plain link.
    }
  }, [pathname]);
  return null;
}

// "Back" on the pin page: returns to wherever you were browsing (the /pins
// wall with its search, sort and page, My pins, a series...) by going back in
// the browser's history, which also restores the scroll position. If you
// arrived from outside the site there's nothing of ours to go back to, so it's
// a plain link to Browse pins.
export function BackButton({ fallbackHref = "/pins", className = "" }: { fallbackHref?: string; className?: string }) {
  const router = useRouter();

  function handleClick(e: React.MouseEvent<HTMLAnchorElement>) {
    // Let modified clicks (new tab etc.) follow the plain link.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    let seen = 0;
    try {
      seen = Number(sessionStorage.getItem(SEEN_KEY) ?? "0");
    } catch {
      seen = 0;
    }
    if (seen > 1 && window.history.length > 1) {
      e.preventDefault();
      router.back();
    }
  }

  return (
    <Link
      href={fallbackHref}
      onClick={handleClick}
      className={`inline-flex items-center gap-1 rounded-full bg-navy/90 px-4 py-2 text-sm font-medium text-cream shadow hover:bg-navy ${className}`}
    >
      <span aria-hidden>&larr;</span> Back
    </Link>
  );
}
