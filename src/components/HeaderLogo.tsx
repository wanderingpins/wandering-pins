"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/Logo";

// The front page already shows the logo huge on the cork board, so the header
// drops its own copy there. The crop trims the logo's empty margin so it can
// sit in a short header bar.
export function HeaderLogo() {
  const pathname = usePathname();
  if (pathname === "/") return <span />;

  return (
    <Link href="/" aria-label="Wandering Pins home">
      <Logo viewBox="30 55 570 365" className="h-16 w-auto overflow-visible" />
    </Link>
  );
}
