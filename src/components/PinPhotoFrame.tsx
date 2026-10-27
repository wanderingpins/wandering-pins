import type { ReactNode } from "react";
import { PushPin } from "@/components/PushPin";

// A photo print pinned to the cork board. Tilted +4deg by default — the
// opposite of the logo's -4deg "P" — with the logo's gold outline and
// dark-gold drop edge.
export function PinPhotoFrame({
  children,
  tilt = 4,
  pinColor,
}: {
  children: ReactNode;
  tilt?: number;
  pinColor?: string;
}) {
  return (
    <div
      className="relative rounded-sm bg-cream p-2 ring-[3px] ring-gold shadow-[0_4px_0_#8E6E14,0_9px_10px_rgba(0,0,0,0.42)]"
      style={{ transform: `rotate(${tilt}deg)` }}
    >
      <PushPin color={pinColor} className="-top-2 left-1/2 -translate-x-1/2" />
      {children}
    </div>
  );
}
