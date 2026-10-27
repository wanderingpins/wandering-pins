// A garage-sale-style starburst sticker for the cork cards (/pins and
// /my-pins): a short status for the pin. Gold edge to match the pills and photo
// frames; the fill color varies per pin (pin-card-style.ts).

const POINTS = 16;
const OUTER = 50; // % of the box: tips of the burst
const INNER = 42; // % of the box: valleys between tips

// Alternating tip/valley points around the center, as a CSS polygon().
const BURST = `polygon(${Array.from({ length: POINTS * 2 }, (_, i) => {
  const angle = (Math.PI * i) / POINTS - Math.PI / 2;
  const r = i % 2 === 0 ? OUTER : INNER;
  return `${(50 + r * Math.cos(angle)).toFixed(2)}% ${(50 + r * Math.sin(angle)).toFixed(2)}%`;
}).join(", ")})`;

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
    <div className={className} style={{ transform: `rotate(${tilt}deg)`, filter: "drop-shadow(0 4px 4px rgba(0,0,0,0.4))" }}>
      <span className="sr-only">{srText}</span>
      <div aria-hidden="true" className="relative size-28 bg-gold" style={{ clipPath: BURST }}>
        <div className="absolute inset-[5px]" style={{ clipPath: BURST, backgroundColor: color }} />
        <div className="absolute inset-0 flex flex-col items-center justify-center px-3 text-center font-display uppercase leading-none text-cork-ink">
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
        </div>
      </div>
    </div>
  );
}
