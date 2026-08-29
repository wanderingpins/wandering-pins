"use client";

import { useActionState } from "react";
import { updateCheckInNote, type ActionState } from "./checkin-actions";

export function CheckInNoteForm({ checkInId, initialBody }: { checkInId: string; initialBody: string }) {
  const action = updateCheckInNote.bind(null, checkInId);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, { status: "idle" });

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <textarea
        name="body"
        rows={2}
        defaultValue={initialBody}
        placeholder="What happened here? (optional)"
        className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
      />
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md border border-neutral-300 px-3 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save"}
      </button>
      {state.status === "error" && <p className="text-xs text-red-600">{state.message}</p>}
    </form>
  );
}
