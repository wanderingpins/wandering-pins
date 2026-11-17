import Link from "next/link";
import { CorkBoard } from "@/components/CorkBoard";
import { Logo } from "@/components/Logo";
import { PinLookupForm } from "@/components/PinLookupForm";

type HomePin = { href: string; label: string; color: string; tilt: number };

// The six ways in, as enamel pins stuck to the board around the logo: three
// down each side on a wide screen, two rows of three on a tablet, one column
// on a phone. Colors are the pill enamels from pin-card-style; the tilts are
// hand-picked so neighbours lean different ways.
const LEFT: HomePin[] = [
  { href: "/pins", label: "Browse pins", color: "#35948A", tilt: -4 },
  { href: "/series", label: "Series", color: "#7C4A8B", tilt: 3 },
  { href: "/my-pins", label: "My pins", color: "#C0561F", tilt: -2 },
];
const RIGHT: HomePin[] = [
  { href: "/settings", label: "Settings", color: "#3B6FA8", tilt: 3 },
  { href: "/about", label: "About", color: "#B13F3A", tilt: -3 },
  { href: "/how-it-works", label: "How it works", color: "#4E8A3E", tilt: 4 },
];

export default function Home() {
  return (
    <main className="flex flex-1 flex-col">
      <CorkBoard className="flex flex-1 flex-col items-center justify-center px-4 py-12 text-center">
        <div className="grid w-full max-w-6xl grid-cols-1 items-center gap-10 lg:grid-cols-[1fr_minmax(0,34rem)_1fr] lg:gap-6">
          <PinColumn pins={LEFT} label="Explore" className="order-2 lg:order-1" />

          <div className="order-1 flex flex-col items-center lg:order-2">
            <h1 className="sr-only">Wandering Pins</h1>
            <Logo surface="cork" className="w-full max-h-[40vh] max-w-[560px]" />
            <p className="mt-6 max-w-md text-lg font-medium text-cork-ink">
              Every pin has a journey. Scan the code on the back, or type it below, to see where it&apos;s been.
            </p>
            <div className="mt-8 w-full max-w-sm rounded-xl bg-navy/95 p-3 text-left shadow-xl ring-2 ring-gold/70 sm:p-4">
              <PinLookupForm />
            </div>
          </div>

          <PinColumn pins={RIGHT} label="About Wandering Pins" className="order-3" />
        </div>
      </CorkBoard>
    </main>
  );
}

function PinColumn({ pins, label, className }: { pins: HomePin[]; label: string; className: string }) {
  return (
    <nav aria-label={label} className={className}>
      <ul className="grid grid-cols-1 justify-items-center gap-6 sm:grid-cols-3 lg:h-full lg:grid-cols-1 lg:content-around lg:gap-14">
        {pins.map((p) => (
          <li key={p.href} className="w-full max-w-[13rem]">
            <Link
              href={p.href}
              style={{ backgroundColor: p.color, rotate: `${p.tilt}deg` }}
              className="flex w-full items-center justify-center whitespace-nowrap rounded-[2rem] border-[4px] border-gold px-4 py-3 font-display text-sm sm:text-base font-bold uppercase tracking-[0.12em] text-cream shadow-[0_4px_0_#8E6E14,0_9px_10px_rgba(0,0,0,0.42)] transition-transform hover:-translate-y-1 hover:!rotate-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cream active:translate-y-0.5"
            >
              {p.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
