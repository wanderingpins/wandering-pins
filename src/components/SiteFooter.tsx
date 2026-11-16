import Link from "next/link";

// Small links at the bottom of every page. `mt-auto` pushes it to the bottom
// of the viewport on short pages (the body is a min-h-full flex column).
export function SiteFooter() {
  const link = "px-2 py-2 hover:text-white";
  return (
    <footer className="mt-auto border-t border-neutral-200 px-4 py-4 text-sm text-neutral-500">
      <nav className="mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-x-4">
        <Link href="/about" className={link}>
          About
        </Link>
        <Link href="/how-it-works" className={link}>
          How it works
        </Link>
        <Link href="/series" className={link}>
          Series
        </Link>
      </nav>
    </footer>
  );
}
