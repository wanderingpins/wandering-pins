"use client";

import { useActionState } from "react";
import { updateHoldingDetails, type ActionState } from "./actions";

export function DetailsForm({
  holdingId,
  initialTitle,
  initialNotes,
  initialReleaseDate,
  initialReleasePlaceLabel,
  isReleased,
}: {
  holdingId: string;
  initialTitle: string;
  initialNotes: string;
  initialReleaseDate: string;
  initialReleasePlaceLabel: string;
  isReleased: boolean;
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
        <span className="text-xs text-neutral-500">
          🌐 Shown publicly on this pin&apos;s page while it&apos;s your current holding.
        </span>
      </label>

      <p className="inline-flex items-center gap-1.5 self-start rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-600">
        🔒 Only you can see this
      </p>
      <label className="flex flex-col gap-1 text-sm">
        Notes
        <textarea
          name="notes"
          rows={4}
          defaultValue={initialNotes}
          className="rounded-md border border-neutral-300 px-3 py-2"
        />
      </label>
      {isReleased && (
        <>
          <label className="flex flex-col gap-1 text-sm">
            When did you let it go? <span className="text-neutral-400">(optional)</span>
            <input
              type="date"
              name="releaseDate"
              defaultValue={initialReleaseDate}
              className="rounded-md border border-neutral-300 px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Where did you leave or trade it? <span className="text-neutral-400">(optional)</span>
            <input
              type="text"
              name="releasePlaceLabel"
              defaultValue={initialReleasePlaceLabel}
              placeholder="e.g. Epcot pin board"
              className="rounded-md border border-neutral-300 px-3 py-2"
            />
          </label>
        </>
      )}
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
