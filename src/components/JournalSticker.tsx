// The "Bought in / Albuquerque, NM" label stuck onto a journal page: a rounded
// die-cut sticker with a white border, in one of the pin-card sticker colors.
// The drop-shadow filter (not a box-shadow) is what outlines the white border
// against the white-ish paper.
export function JournalSticker({
  kicker,
  place,
  color,
  tilt,
  className = "",
}: {
  kicker: string;
  place: string;
  color: string;
  tilt: number;
  className?: string;
}) {
  return (
    <div
      className={`w-fit max-w-full ${className}`}
      style={{ transform: `rotate(${tilt}deg)`, filter: "drop-shadow(0 3px 3px rgba(0,0,0,0.35))" }}
    >
      <div className="rounded-2xl border-4 border-white px-3.5 py-1.5 text-cork-ink" style={{ backgroundColor: color }}>
        <span className="block text-[10px] font-extrabold uppercase leading-none tracking-[0.2em]">{kicker}</span>
        <span className="mt-1 line-clamp-2 block break-words font-display text-lg font-extrabold leading-[1.1]">{place}</span>
      </div>
    </div>
  );
}

// The last sticker on the page: a pill with a dashed inner rule, so it reads as
// different from the place stickers (and it's always cream, never a random color).
export function EndSticker({ tilt = -3, className = "" }: { tilt?: number; className?: string }) {
  return (
    <div
      className={`w-fit ${className}`}
      style={{ transform: `rotate(${tilt}deg)`, filter: "drop-shadow(0 3px 3px rgba(0,0,0,0.35))" }}
    >
      <div className="rounded-[2rem] border-4 border-white bg-cream p-1 text-cork-ink">
        <div className="rounded-[1.6rem] border-2 border-dashed border-cork-ink/50 py-1.5 pl-8 pr-5 text-center">
          <span className="block font-display text-xl font-extrabold leading-none">The End</span>
          <span className="mt-1 block text-[10px] font-extrabold uppercase leading-none tracking-[0.2em]">(So Far)</span>
        </div>
      </div>
    </div>
  );
}
