import type { ReactNode } from "react";

// A small print taped into a journal page, leaning a few degrees (the caller
// passes journalPhotoTilt(photo.id)). `children` is for an overlay control such
// as the delete button, placed by the caller with absolute positioning.
export function JournalPhoto({ src, tilt, children }: { src: string; tilt: number; children?: ReactNode }) {
  return (
    <div
      className="relative shrink-0 rounded-[2px] bg-white p-1.5 pb-5 shadow-[0_3px_6px_rgba(0,0,0,0.35)]"
      style={{ transform: `rotate(${tilt}deg)` }}
    >
      <span aria-hidden="true" className="absolute -top-2 left-1/2 h-4 w-10 -translate-x-1/2 -rotate-3 bg-gold/60" />
      {/* eslint-disable-next-line @next/next/no-img-element -- private, per-user image behind an auth-gated route */}
      <img src={src} alt="" className="size-24 object-cover" />
      {children}
    </div>
  );
}
