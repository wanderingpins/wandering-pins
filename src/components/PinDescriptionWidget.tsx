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

  // Lives on TornPaper, so colors are ink-on-paper rather than the app's
  // navy-theme neutrals, and every row is 28px (leading-7) to sit on the
  // paper's ruled lines.
  if (!editing) {
    return (
      <div className="flex flex-col">
        <p className="font-sans text-xs leading-7 text-ink/60">🌐 Shown publicly on this pin&apos;s page.</p>
        <p className="whitespace-pre-wrap font-hand text-[22px] leading-7 text-ink">
          {initialDescription || <span className="text-ink/40">No description</span>}
        </p>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="self-start font-sans text-sm font-medium leading-7 text-brand-hover underline"
        >
          Edit
        </button>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col">
      <p className="font-sans text-xs leading-7 text-ink/60">🌐 Shown publicly on this pin&apos;s page.</p>
      <textarea
        name="description"
        rows={4}
        defaultValue={initialDescription}
        placeholder="Tell visitors about this pin (optional)"
        className="w-full resize-none bg-transparent font-hand text-[22px] leading-7 text-ink placeholder:text-ink/40 focus:outline-none"
      />
      <div className="flex items-center gap-2 py-0.5">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-brand px-3 py-1 font-sans text-xs font-medium text-white hover:bg-brand-hover disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          disabled={pending}
          className="rounded-md px-3 py-1 font-sans text-xs font-medium text-ink/70 hover:bg-ink/10 disabled:opacity-60"
        >
          Cancel
        </button>
      </div>
      {state.status === "error" && <p className="font-sans text-xs leading-7 text-red-700">{state.message}</p>}
    </form>
  );
}
