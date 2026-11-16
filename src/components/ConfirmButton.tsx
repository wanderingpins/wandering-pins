"use client";

import type { ReactNode } from "react";

// A submit button that asks "are you sure?" first — for the admin page's
// delete/remove actions, which can't be undone.
export function ConfirmButton({ message, className = "", children }: { message: string; className?: string; children: ReactNode }) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
