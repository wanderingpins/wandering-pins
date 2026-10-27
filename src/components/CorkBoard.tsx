import type { ReactNode } from "react";

// Cork texture from design/cork-texture.svg. Sized in pixels (no viewBox) so
// the noise grain keeps its natural scale at any screen size instead of being
// stretched. The wooden frame is plain CSS rather than an SVG stroke.
export function CorkBoard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`relative isolate overflow-hidden border-[17px] border-cork-frame bg-[#C08A4E] shadow-[inset_0_0_0_2px_rgba(49,29,11,0.6)] ${className}`}
    >
      <svg aria-hidden="true" className="absolute inset-0 -z-10 h-full w-full" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="ckMottle" x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="3" seed="11" />
            <feColorMatrix type="matrix" values="0 0 0 0 0.42  0 0 0 0 0.27  0 0 0 0 0.12  1.4 0 0 0 -0.62" />
          </filter>
          <filter id="ckDark" x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.16" numOctaves="2" seed="5" />
            <feColorMatrix type="matrix" values="0 0 0 0 0.30  0 0 0 0 0.17  0 0 0 0 0.06  3.4 0 0 0 -1.75" />
          </filter>
          <filter id="ckSpeck" x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="1" seed="23" />
            <feColorMatrix type="matrix" values="0 0 0 0 0.26  0 0 0 0 0.14  0 0 0 0 0.05  4 0 0 0 -2.25" />
          </filter>
          <filter id="ckLight" x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.34" numOctaves="2" seed="41" />
            <feColorMatrix type="matrix" values="0 0 0 0 0.90  0 0 0 0 0.78  0 0 0 0 0.56  3 0 0 0 -1.72" />
          </filter>
          <radialGradient id="ckVig" cx="50%" cy="40%" r="74%">
            <stop offset="0.5" stopColor="#000" stopOpacity="0" />
            <stop offset="1" stopColor="#000" stopOpacity="0.36" />
          </radialGradient>
        </defs>
        <rect width="100%" height="100%" fill="#C08A4E" />
        <rect width="100%" height="100%" filter="url(#ckMottle)" />
        <rect width="100%" height="100%" filter="url(#ckLight)" opacity="0.75" />
        <rect width="100%" height="100%" filter="url(#ckDark)" opacity="0.85" />
        <rect width="100%" height="100%" filter="url(#ckSpeck)" opacity="0.55" />
        <rect width="100%" height="100%" fill="url(#ckVig)" />
      </svg>
      {children}
    </div>
  );
}
