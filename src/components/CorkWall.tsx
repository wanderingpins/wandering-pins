import type { ReactNode } from "react";
import { CorkBoard } from "@/components/CorkBoard";

// The cork-board grid of pin cards, shared by /pins and /my-pins: as many cards
// side by side as fit, one column on a phone. Children are the <li> cards.
export function CorkWall({ children, className = "mt-6" }: { children: ReactNode; className?: string }) {
  return (
    <CorkBoard className={`${className} px-4 py-10 sm:px-8`}>
      <ul className="mx-auto grid max-w-6xl grid-cols-1 gap-x-6 gap-y-12 sm:grid-cols-[repeat(auto-fill,minmax(300px,1fr))]">
        {children}
      </ul>
    </CorkBoard>
  );
}
