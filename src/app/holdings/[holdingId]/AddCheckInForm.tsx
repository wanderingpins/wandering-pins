"use client";

import { useActionState } from "react";
import { addCheckIn, type ActionState } from "./checkin-actions";

export function AddCheckInForm({ holdingId }: { holdingId: string }) {
  const action = addCheckIn.bind(null, holdingId);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, { status: "idle" });

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-lg border border-neutral-200 p-4">
      <p className="text-sm font-medium text-neutral-700">Log a new location</p>
      <p className="text-xs text-neutral-500">
        🌐 The place and date show up publicly on this pin&apos;s journey — same as where you got it.
      </p>
      <label className="flex flex-col gap-1 text-sm">
        Where?
        <input
          type="text"
          name="place"
          required
          placeholder="Denver, CO"
          className="rounded-md border border-neutral-300 px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        When?
        <input type="date" name="loggedAt" required className="rounded-md border border-neutral-300 px-3 py-2" />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
      >
        {pending ? "Logging…" : "Log this location"}
      </button>
      {state.status === "error" && <p className="text-sm text-red-600">{state.message}</p>}
    </form>
  );
}
