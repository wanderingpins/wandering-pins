"use client";

import { useActionState } from "react";
import { updateHoldingDetails, type ActionState } from "./actions";

export function DetailsForm({
  holdingId,
  initialTitle,
  initialNotes,
}: {
  holdingId: string;
  initialTitle: string;
  initialNotes: string;
}) {
  const action = updateHoldingDetails.bind(null, holdingId);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, { status: "idle" });

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        Give it a name
        <input
          type="text"
          name="title"
          defaultValue={initialTitle}
          className="rounded-md border border-neutral-300 px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Notes
        <textarea
          name="notes"
          rows={4}
          defaultValue={initialNotes}
          className="rounded-md border border-neutral-300 px-3 py-2"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save"}
      </button>
      {state.status === "ok" && <p className="text-sm text-green-700">Saved.</p>}
      {state.status === "error" && <p className="text-sm text-red-600">{state.message}</p>}
    </form>
  );
}
