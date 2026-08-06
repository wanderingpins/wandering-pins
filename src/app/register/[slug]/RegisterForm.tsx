"use client";

import { useActionState } from "react";
import { registerPin, type RegisterState } from "./actions";

const ACQUIRED_VIA_OPTIONS = [
  { value: "BOUGHT", label: "Bought it" },
  { value: "TRADED", label: "Traded for it" },
  { value: "GIFT", label: "Got it as a gift" },
  { value: "FOUND", label: "Found it" },
  { value: "OTHER", label: "Other" },
] as const;

export function RegisterForm({ slug }: { slug: string }) {
  const action = registerPin.bind(null, slug);
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
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
      >
        {pending ? "Registering…" : "Register this pin"}
      </button>
      {state.status === "error" && <p className="text-sm text-red-600">{state.message}</p>}
    </form>
  );
}
