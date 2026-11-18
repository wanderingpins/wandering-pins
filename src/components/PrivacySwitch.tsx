"use client";

import { useState, useTransition } from "react";

type Result = { status: "idle" | "ok" | "error"; message?: string };

// An on/off switch bound to a server action that takes the new value — the
// "Keep my part private" and "Only show the state" controls. Shows the new
// position straight away and puts it back if the action fails.
export function PrivacySwitch({
  on,
  label,
  hint,
  action,
  tone = "light",
}: {
  on: boolean;
  label: string;
  /** One short line under the label: what strangers will see. */
  hint?: string;
  action: (next: boolean) => Promise<Result>;
  /** "dark" for use on the navy page background, "light" on paper/white. */
  tone?: "light" | "dark";
}) {
  const [checked, setChecked] = useState(on);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Follow the server's value when the page re-renders with a new one.
  const [prevOn, setPrevOn] = useState(on);
  if (on !== prevOn) {
    setPrevOn(on);
    setChecked(on);
  }

  function toggle() {
    const next = !checked;
    setChecked(next);
    setError(null);
    startTransition(async () => {
      const result = await action(next);
      if (result.status === "error") {
        setChecked(!next);
        setError(result.message ?? "Couldn't change that — please try again.");
      }
    });
  }

  const text = tone === "dark" ? "text-cream" : "text-neutral-900";
  const sub = tone === "dark" ? "text-cream/70" : "text-neutral-500";

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={toggle}
        disabled={pending}
        className={`flex items-center gap-3 text-left text-sm ${text} disabled:opacity-70`}
      >
        <span
          aria-hidden="true"
          className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-gold transition-colors ${
            checked ? "bg-brand" : "bg-neutral-300"
          }`}
        >
          <span
            className={`absolute top-0.5 size-4 rounded-full bg-cream shadow transition-transform ${
              checked ? "translate-x-[1.35rem]" : "translate-x-0.5"
            }`}
          />
        </span>
        <span className="font-medium">{label}</span>
      </button>
      {hint && <p className={`pl-14 text-xs ${sub}`}>{hint}</p>}
      {error && <p className="pl-14 text-xs text-red-600">{error}</p>}
    </div>
  );
}
