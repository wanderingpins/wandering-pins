// The pin's name, styled like the "WANDERING" pill in the logo (Logo.tsx):
// colored enamel, gold outline, dark-gold drop edge, same -1.2deg tilt. Teal
// by default (the logo's own); the /pins cork view passes a per-pin color.
import type { ReactNode } from "react";

const SIZES = {
  lg: "max-w-full rounded-[2rem] border-[5px] px-8 py-3 text-xl tracking-[0.18em] shadow-[0_4px_0_#8E6E14,0_9px_10px_rgba(0,0,0,0.42)] sm:px-12 sm:text-3xl",
  sm: "line-clamp-2 max-w-[13rem] rounded-2xl border-[3px] px-4 py-1.5 text-sm tracking-[0.12em] shadow-[0_3px_0_#8E6E14,0_6px_7px_rgba(0,0,0,0.4)]",
} as const;

export function PinNamePill({
  children,
  color = "#35948A",
  size = "lg",
  as: Tag = "h1",
}: {
  children: ReactNode;
  color?: string;
  size?: keyof typeof SIZES;
  as?: "h1" | "h2";
}) {
  return (
    <Tag
      className={`-rotate-[1.2deg] break-words border-gold text-center font-display font-bold uppercase text-cream ${SIZES[size]}`}
      style={{ backgroundColor: color }}
    >
      {children}
    </Tag>
  );
}
