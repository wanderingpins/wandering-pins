"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { Starburst } from "@/components/PinSticker";

// "Edit mode" for the pin page (/p/[number]). For anyone who owns something on
// the page, nothing is editable until they press the "Edit pin information"
// sticker; every editing widget reads this and shows its read-only view
// otherwise. The default (no provider, i.e. an anonymous visitor) is "not
// editing", so widgets that are only ever rendered for owners still behave
// everywhere else.
const EditModeContext = createContext<{ editing: boolean; setEditing: (editing: boolean) => void }>({
  editing: false,
  setEditing: () => {},
});

export function PinEditProvider({ children }: { children: ReactNode }) {
  const [editing, setEditing] = useState(false);
  return <EditModeContext.Provider value={{ editing, setEditing }}>{children}</EditModeContext.Provider>;
}

export function useEditMode(): boolean {
  return useContext(EditModeContext).editing;
}

// Children (typically server-rendered owner controls) that exist only while editing.
export function EditOnly({ children }: { children: ReactNode }) {
  return useEditMode() ? <>{children}</> : null;
}

// The button that turns edit mode on and off, drawn as a starburst sticker.
export function EditPinSticker({ color, tilt, className = "" }: { color: string; tilt: number; className?: string }) {
  const { editing, setEditing } = useContext(EditModeContext);
  return (
    <button
      type="button"
      aria-pressed={editing}
      aria-label={editing ? "Done editing" : "Edit pin information"}
      onClick={() => setEditing(!editing)}
      className={`block cursor-pointer transition-transform hover:scale-105 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cream ${className}`}
    >
      <Starburst color={color} tilt={tilt} sizeClass="size-32">
        {editing ? (
          <>
            <span className="text-[13px] font-extrabold leading-[1.1]">Done</span>
            <span className="text-[13px] font-extrabold leading-[1.1]">editing</span>
          </>
        ) : (
          <>
            <span className="text-[13px] font-extrabold leading-[1.1]">Edit pin</span>
            <span className="mt-0.5 text-[10px] font-bold leading-[1.1] tracking-[0.04em]">information</span>
          </>
        )}
      </Starburst>
    </button>
  );
}
