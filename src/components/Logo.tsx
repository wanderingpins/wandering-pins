import type { CSSProperties } from "react";

// Inline SVG (not an <img>) so the lettering picks up the page's self-hosted
// Bricolage Grotesque — an SVG loaded as an image can't see the page's fonts.
// Geometry comes from design/logo.svg.
const GOLD = "#D9B441";
const GOLD_DARK = "#8E6E14";
const ORANGE = "#D06A2E";
const TEAL = "#35948A";
const CREAM = "#F5EDE0";

const FONT = "var(--font-bricolage), 'Avenir Next', 'Segoe UI', system-ui, sans-serif";

type Surface = "navy" | "cork";

// Cork is a busier background, so the shadow is heavier there.
const SHADOW: Record<Surface, string> = {
  navy: "drop-shadow(0 6px 7px rgba(0,0,0,0.30))",
  cork: "drop-shadow(0 9px 10px rgba(0,0,0,0.42))",
};

function Letter({
  char,
  x,
  rotate,
  fill,
  style,
}: {
  char: string;
  x: number;
  rotate: number;
  fill: string;
  style: CSSProperties;
}) {
  const common = {
    x,
    y: 392,
    textAnchor: "middle" as const,
    fontSize: 178,
    fontWeight: 800,
    strokeLinejoin: "round" as const,
    paintOrder: "stroke",
    style: { fontFamily: FONT },
  };
  return (
    <g transform={`rotate(${rotate} ${x} 327.92)`} style={style}>
      <text {...common} transform="translate(0 4.6)" fill={GOLD_DARK} stroke={GOLD_DARK} strokeWidth={21}>
        {char}
      </text>
      <text {...common} fill={fill} stroke={GOLD} strokeWidth={19.6}>
        {char}
      </text>
    </g>
  );
}

export function Logo({
  surface = "navy",
  viewBox = "0 0 660 460",
  className,
}: {
  surface?: Surface;
  viewBox?: string;
  className?: string;
}) {
  const style: CSSProperties = { filter: SHADOW[surface] };

  return (
    <svg
      viewBox={viewBox}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Wandering Pins"
      className={className}
    >
      <g transform="rotate(-1.2 326 112)" style={style}>
        <rect x={76} y={72} width={500} height={80} rx={40} transform="translate(0 4)" fill={GOLD_DARK} stroke={GOLD_DARK} strokeWidth={12.4} strokeLinejoin="round" paintOrder="stroke" />
        <rect x={76} y={72} width={500} height={80} rx={40} fill={TEAL} stroke={GOLD} strokeWidth={11} strokeLinejoin="round" paintOrder="stroke" />
        <text x={333} y={125} textAnchor="middle" fontSize={38} fontWeight={700} letterSpacing={15} fill={CREAM} style={{ fontFamily: FONT }}>
          WANDERING
        </text>
      </g>

      <Letter char="P" x={104} rotate={-4} fill={ORANGE} style={style} />

      <g transform="rotate(3 234 345.5)" style={style}>
        <rect x={217} y={299} width={34} height={93} rx={10} transform="translate(0 5)" fill={GOLD_DARK} stroke={GOLD_DARK} strokeWidth={20} strokeLinejoin="round" paintOrder="stroke" />
        <rect x={217} y={299} width={34} height={93} rx={10} fill={CREAM} stroke={GOLD} strokeWidth={20} strokeLinejoin="round" paintOrder="stroke" />
      </g>

      <Letter char="N" x={376} rotate={-2.5} fill={TEAL} style={style} />
      <Letter char="S" x={550} rotate={4} fill={ORANGE} style={style} />

      <g style={style}>
        <g transform="translate(234 288) rotate(-7) scale(2.8) translate(-12 -24)">
          <path
            d="M12 1.5c-3.87 0-7 3.13-7 7 0 5.05 6.1 12.5 6.36 12.82a.83.83 0 0 0 1.28 0C12.9 21 19 13.55 19 8.5c0-3.87-3.13-7-7-7Zm0 9.75a2.75 2.75 0 1 1 0-5.5a2.75 2.75 0 0 1 0 5.5Z"
            fill={ORANGE}
            fillRule="evenodd"
            stroke={GOLD}
            strokeWidth={1.5}
          />
        </g>
      </g>

      <g style={style}>
        <path
          d="M128 318 C 180 330, 212 330, 260 314 C 302 300, 318 344, 364 386 C 398 418, 470 400, 528 352"
          fill="none"
          stroke={CREAM}
          strokeOpacity={0.88}
          strokeWidth={5}
          strokeLinecap="round"
          strokeDasharray="13 11"
        />
        <circle cx={128} cy={318} r={9} fill={GOLD} stroke={GOLD_DARK} strokeWidth={2.5} />
        <circle cx={528} cy={352} r={9} fill={GOLD} stroke={GOLD_DARK} strokeWidth={2.5} />
      </g>
    </svg>
  );
}
