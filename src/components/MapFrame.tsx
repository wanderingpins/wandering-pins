import type { ReactNode } from "react";

// The journey map's backdrop: a parchment-colored panel with the map inset in a
// brown rule. Pure CSS, no images.
const PARCHMENT = "radial-gradient(ellipse at center, rgba(255,255,255,0.28), rgba(130,90,30,0.3) 100%)";

export function MapFrame({ children }: { children: ReactNode }) {
  return (
    <div
      className="rounded-md bg-[#ecdcb4] px-4 py-6 shadow-[0_8px_8px_rgba(0,0,0,0.35)] sm:px-6"
      style={{ backgroundImage: PARCHMENT }}
    >
      {/* The tiles get a warm tint so the map looks drawn on the parchment. */}
      <div className="overflow-hidden rounded-sm ring-2 ring-[#6e4219]/70 [&_canvas]:[filter:sepia(0.4)_saturate(0.9)]">
        {children}
      </div>
    </div>
  );
}
