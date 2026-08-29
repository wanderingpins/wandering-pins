"use client";

import { useActionState, useState } from "react";
import { updateDescription, type ActionState } from "@/app/holdings/[holdingId]/actions";

// Shown only to the current holder (gated by the caller — /app/p/[slug]/
// page.tsx — same as PinPhotoWidget). A non-owner viewer sees the plain
// description text directly, with no edit affordance and no "No
// description" placeholder for a pin that doesn't have one yet.
export function PinDescriptionWidget({
  holdingId,
  initialDescription,
}: {
  holdingId: string;
  initialDescription: string;
}) {
  const [editing, setEditing] = useState(false);
  const action = updateDescription.bind(null, holdingId);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, { status: "idle" });

  // Adjust state during render rather than in an effect (same pattern used
  // elsewhere on this page) — compares the state *object* itself, not just
  // its status string, so a second save in a row still collapses.
  const [prevState, setPrevState] = useState(state);
  if (state !== prevState) {
    setPrevState(state);
    if (state.status === "ok") setEditing(false);
  }

  if (!editing) {
    return (
      <div className="mt-4 flex flex-col gap-2">
        <p className="text-xs text-neutral-500">🌐 Shown publicly on this pin&apos;s page.</p>
        <p className="whitespace-pre-wrap text-sm text-neutral-800">
          {initialDescription || <span className="text-neutral-400">No description</span>}
        </p>
        <button type="button" onClick={() => setEditing(true)} className="self-start text-sm text-blue-600 hover:underline">
          Edit
        </button>
      </div>
    );
  }

  return (
    <form action={formAction} className="mt-4 flex flex-col gap-2">
      <p className="text-xs text-neutral-500">🌐 Shown publicly on this pin&apos;s page.</p>
      <textarea
        name="description"
        rows={3}
        defaultValue={initialDescription}
        placeholder="Tell visitors about this pin (optional)"
        className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
      />
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          disabled={pending}
          className="rounded-md px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-100 disabled:opacity-60"
        >
          Cancel
        </button>
      </div>
      {state.status === "error" && <p className="text-xs text-red-600">{state.message}</p>}
    </form>
  );
}
