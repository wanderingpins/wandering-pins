// A push pin head for things pinned to the cork board (photo frames, torn
// paper notes). Absolutely positioned: the caller places it with `className`
// inside a `relative` parent. Gold ring and soft shadow match the logo's outlines.
export const DEFAULT_PUSHPIN_COLOR = "#D06A2E";

export function PushPin({ color = DEFAULT_PUSHPIN_COLOR, className = "" }: { color?: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`absolute size-4 rounded-full shadow-[0_2px_3px_rgba(0,0,0,0.5)] ring-2 ring-gold ${className}`}
      style={{ backgroundColor: color }}
    />
  );
}
