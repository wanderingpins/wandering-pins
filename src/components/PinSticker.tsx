import type { ReactNode } from "react";

// Garage-sale-style starburst stickers for the cork pages: the status sticker on
// the /pins and /my-pins cards, and the "Edit pin information" button on the pin
// page. Gold edge to match the pills and photo frames; the fill color varies
// per pin (pin-card-style.ts).

const POINTS = 16;
const OUTER = 50; // % of the box: tips of the burst
const INNER = 42; // % of the box: valleys between tips

// Alternating tip/valley points around the center, as a CSS polygon().
const BURST = `polygon(${Array.from({ length: POINTS * 2 }, (_, i) => {
  const angle = (Math.PI * i) / POINTS - Math.PI / 2;
  const r = i % 2 === 0 ? OUTER : INNER;
  return `${(50 + r * Math.cos(angle)).toFixed(2)}% ${(50 + r * Math.sin(angle)).toFixed(2)}%`;
}).join(", ")})`;

// The starburst itself: gold outline, colored fill, tilt, soft shadow, with
// `children` centered on it in dark ink. With `srText` the visual is hidden
// from screen readers and that sentence is read instead; without it (e.g. a
// button's label) the children are the accessible content.
export function Starburst({
  color,
  tilt,
  className = "",
  sizeClass = "size-28",
  srText,
  children,
}: {
  color: string;
  tilt: number;
  className?: string;
  sizeClass?: string;
  srText?: string;
  children: ReactNode;
}) {
  return (
    <div className={className} style={{ transform: `rotate(${tilt}deg)`, filter: "drop-shadow(0 4px 4px rgba(0,0,0,0.4))" }}>
      {srText && <span className="sr-only">{srText}</span>}
      <div aria-hidden={srText ? true : undefined} className={`relative bg-gold ${sizeClass}`} style={{ clipPath: BURST }}>
        <div className="absolute inset-[5px]" style={{ clipPath: BURST, backgroundColor: color }} />
        <div className="absolute inset-0 flex flex-col items-center justify-center px-3 text-center font-display uppercase leading-none text-cork-ink">
          {children}
        </div>
      </div>
    </div>
  );
}

export function PinSticker({
  kicker,
  headline,
  count,
  srText,
  color,
  tilt,
  className = "",
}: {
  /** Tiny line above the headline, e.g. "With" or "Now in". */
  kicker?: string;
  /** The main line: a name, a place, or a short phrase. */
  headline: string;
  /** Optional big number with a label under it, e.g. the verified-location count. */
  count?: { value: number; label: string };
  /** The full status as a sentence, for screen readers (the visual is aria-hidden). */
  srText: string;
  color: string;
  tilt: number;
  className?: string;
}) {
  return (
    <Starburst color={color} tilt={tilt} className={className} srText={srText}>
      {kicker && <span className="text-[9px] font-bold tracking-[0.2em]">{kicker}</span>}
      {/* With a count underneath the headline stays on one line; on its own
          it gets two, since there's room. */}
      <span
        className={`mt-0.5 max-w-[4.75rem] break-words font-extrabold normal-case ${
          count ? "truncate text-xs" : "line-clamp-2 text-[13px] leading-[1.1]"
        }`}
      >
        {headline}
      </span>
      {count && (
        <>
          <span className="mt-1 text-2xl font-extrabold">{count.value}</span>
          <span className="text-[8px] font-bold tracking-[0.15em]">{count.label}</span>
        </>
      )}
    </Starburst>
  );
}
