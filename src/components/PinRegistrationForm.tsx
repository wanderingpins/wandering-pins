"use client";

import { useActionState } from "react";
import type { RegisterState } from "@/lib/register-form";

const ACQUIRED_VIA_OPTIONS = [
  { value: "BOUGHT", label: "Bought it" },
  { value: "TRADED", label: "Traded for it" },
  { value: "GIFT", label: "Got it as a gift" },
  { value: "FOUND", label: "Found it" },
  { value: "OTHER", label: "Other" },
] as const;

// The how/when/where form for a pin's first holding, bound to whichever
// server action the page wants — registering with a sticker, or adding a
// pin that has none yet.
export function PinRegistrationForm({
  action,
  submitLabel = "Register this pin",
  pendingLabel = "Registering…",
}: {
  action: (prevState: RegisterState, formData: FormData) => Promise<RegisterState>;
  submitLabel?: string;
  pendingLabel?: string;
}) {
  const [state, formAction, pending] = useActionState<RegisterState, FormData>(action, {
    status: "idle",
  });

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        How did you get it?
        <select name="acquiredVia" required className="rounded-md border border-neutral-300 px-3 py-2">
          {ACQUIRED_VIA_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Roughly when?
        <input type="date" name="acquiredAt" required className="rounded-md border border-neutral-300 px-3 py-2" />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Where? (city is enough)
        <input
          type="text"
          name="place"
          required
          placeholder="Orlando, FL"
          className="rounded-md border border-neutral-300 px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Give it a name <span className="text-neutral-400">(optional, only you can see this)</span>
        <input type="text" name="title" className="rounded-md border border-neutral-300 px-3 py-2" />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Notes <span className="text-neutral-400">(optional, only you can see this)</span>
        <textarea name="notes" rows={3} className="rounded-md border border-neutral-300 px-3 py-2" />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-60"
      >
        {pending ? pendingLabel : submitLabel}
      </button>
      {state.status === "error" && <p className="text-sm text-red-600">{state.message}</p>}
    </form>
  );
}
