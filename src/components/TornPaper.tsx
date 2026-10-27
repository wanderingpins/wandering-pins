import type { ReactNode } from "react";
import { PushPin } from "@/components/PushPin";

// Ragged top edge, so it reads as torn out rather than cut.
const TORN_EDGE =
  "polygon(0 6px, 4% 2px, 9% 7px, 14% 3px, 20% 8px, 26% 2px, 33% 6px, 39% 1px, 46% 7px, 52% 3px, 59% 8px, 65% 2px, 72% 6px, 79% 1px, 86% 7px, 92% 3px, 100% 6px, 100% 100%, 0 100%)";

// Ruled lines every 28px; children should use a 28px line height so their
// text sits on the lines. Offset by the top padding so the first line lines up.
const RULES = "repeating-linear-gradient(to bottom, transparent 0 27px, rgba(96,150,200,0.45) 27px 28px)";

const HOLES = ["top-[12%]", "top-1/2 -translate-y-1/2", "bottom-[12%]"];

// A sheet of binder paper pinned to the cork: ruled lines, red margin, punched
// holes, torn edge, tilted -5deg by default. The clip-path would clip a
// box-shadow, so the shadow is a drop-shadow filter on the outer wrapper.
// `compact` is the narrower sheet used on the /pins cork cards.
export function TornPaper({
  children,
  className = "",
  tilt = -5,
  compact = false,
  pinColor,
}: {
  children: ReactNode;
  className?: string;
  tilt?: number;
  compact?: boolean;
  pinColor?: string;
}) {
  return (
    <div className={`relative ${className}`} style={{ transform: `rotate(${tilt}deg)`, filter: "drop-shadow(0 9px 8px rgba(0,0,0,0.4))" }}>
      {/* On the outer wrapper, not the clipped sheet, so the torn-edge
          clip-path can't cut it off; its head sits just inside the torn edge
          (the edge wobbles 1-8px down) so it reads as pushed into the paper. */}
      <PushPin color={pinColor} className="left-1/2 top-0 z-10 -translate-x-1/2" />
      <div
        className={`relative max-w-full bg-paper ${compact ? "w-56 pb-4 pl-12 pr-4 pt-6" : "w-72 pb-5 pl-14 pr-5 pt-6"}`}
        style={{ clipPath: TORN_EDGE, backgroundImage: RULES, backgroundPosition: "0 24px" }}
      >
        <span aria-hidden="true" className={`absolute inset-y-0 w-0.5 bg-red-400/50 ${compact ? "left-9" : "left-11"}`} />
        {HOLES.map((pos) => (
          <span
            key={pos}
            aria-hidden="true"
            className={`absolute rounded-full bg-[#a4733c] shadow-[inset_0_2px_3px_rgba(0,0,0,0.5)] ${compact ? "left-2.5 size-3.5" : "left-3 size-4"} ${pos}`}
          />
        ))}
        {children}
      </div>
    </div>
  );
}
