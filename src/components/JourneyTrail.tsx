"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

// The dotted trail from the logo, drawn as ONE path so the dashes never break:
// from the bottom edge of the map, down through every push pin on the page.
// Each element marked `data-trail-pin` (an empty anchor at a pin's center, with
// `data-variant` picking the wiggle) is a stop; the layout decides where they
// sit, so the path is measured here and redrawn whenever the page reflows.
const X = 36; // the pin column, px from the left edge
const GUTTER = 44;
const START_Y = -12; // the gold start dot's center: above the map panel's bottom edge, so inside it
const STROKE = {
  fill: "none",
  stroke: "#F5EDE0",
  strokeOpacity: 0.88,
  strokeWidth: 4,
  strokeLinecap: "round",
  strokeDasharray: "10 9",
} as const;

// Each continues the path from (X, a) to (X, b), wandering through the gutter.
function wiggleAt(a: number, b: number) {
  return (t: number) => (a + (b - a) * t).toFixed(1);
}
const WIGGLES = [
  (a: number, b: number) => {
    const y = wiggleAt(a, b);
    return `C 4 ${y(0.2)}, 4 ${y(0.44)}, 22 ${y(0.56)} S 44 ${y(0.82)}, ${X} ${b}`;
  },
  (a: number, b: number) => {
    const y = wiggleAt(a, b);
    return `C 44 ${y(0.24)}, 8 ${y(0.3)}, 14 ${y(0.56)} S 46 ${y(0.7)}, ${X} ${b}`;
  },
  (a: number, b: number) => {
    const y = wiggleAt(a, b);
    return `C 18 ${y(0.14)}, 40 ${y(0.4)}, 20 ${y(0.58)} S 8 ${y(0.86)}, ${X} ${b}`;
  },
];

export function JourneyTrail({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [trail, setTrail] = useState<{ d: string; height: number } | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const measure = () => {
      const rect = root.getBoundingClientRect();
      let d = `M ${X} ${START_Y}`;
      let prev = START_Y;
      for (const pin of root.querySelectorAll<HTMLElement>("[data-trail-pin]")) {
        const y = Math.round(pin.getBoundingClientRect().top - rect.top);
        const wiggle = WIGGLES[Number(pin.dataset.variant ?? 0) % WIGGLES.length];
        d += y - prev < 24 ? ` L ${X} ${y}` : ` ${wiggle(prev, y)}`;
        prev = y;
      }
      const height = Math.ceil(rect.height);
      setTrail((old) => (old && old.d === d && old.height === height ? old : { d, height }));
    };

    // Fires once on observe, then on every size change (wrapping text, fonts,
    // photos arriving); image loads don't bubble, so catch them in capture.
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    root.addEventListener("load", measure, true);
    document.fonts?.ready.then(measure);
    return () => {
      observer.disconnect();
      root.removeEventListener("load", measure, true);
    };
  }, []);

  return (
    <div ref={rootRef} className="relative">
      {trail && (
        <svg
          aria-hidden="true"
          width={GUTTER}
          height={trail.height}
          viewBox={`0 0 ${GUTTER} ${trail.height}`}
          className="pointer-events-none absolute left-0 top-0 overflow-visible"
        >
          <path d={trail.d} {...STROKE} />
          {/* The logo's gold start dot, tucked just inside the map panel's bottom edge. */}
          <circle cx={X} cy={START_Y} r={7} fill="#D9B441" stroke="#8E6E14" strokeWidth={2} />
        </svg>
      )}
      {children}
    </div>
  );
}
