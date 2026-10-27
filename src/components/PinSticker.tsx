// A garage-sale-style starburst sticker for the /pins cork cards: who has the
// pin right now and how many of its locations are verified. Gold edge to match
// the pills and photo frames; the fill color varies per pin (pin-card-style.ts).

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
  holderDisplayName,
  verifiedCount,
  color,
  tilt,
  className = "",
}: {
  holderDisplayName: string | null;
  verifiedCount: number;
  color: string;
  tilt: number;
  className?: string;
}) {
  const sentence = `${holderDisplayName ? `Currently with ${holderDisplayName}` : "Not currently held by anyone"}. ${verifiedCount} verified location${verifiedCount === 1 ? "" : "s"}.`;

  return (
    <div className={className} style={{ transform: `rotate(${tilt}deg)`, filter: "drop-shadow(0 4px 4px rgba(0,0,0,0.4))" }}>
      <span className="sr-only">{sentence}</span>
      <div aria-hidden="true" className="relative size-28 bg-gold" style={{ clipPath: BURST }}>
        <div className="absolute inset-[5px]" style={{ clipPath: BURST, backgroundColor: color }} />
        <div className="absolute inset-0 flex flex-col items-center justify-center px-3 text-center font-display uppercase leading-none text-cork-ink">
          {holderDisplayName ? (
            <>
              <span className="text-[9px] font-bold tracking-[0.2em]">With</span>
              <span className="mt-0.5 max-w-[4.75rem] truncate text-xs font-extrabold normal-case">{holderDisplayName}</span>
            </>
          ) : (
            <span className="text-[11px] font-extrabold leading-[1.05]">
              Up for
              <br />
              grabs
            </span>
          )}
          <span className="mt-1 text-2xl font-extrabold">{verifiedCount}</span>
          <span className="text-[8px] font-bold tracking-[0.15em]">Verified</span>
        </div>
      </div>
    </div>
  );
}
