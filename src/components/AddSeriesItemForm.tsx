"use client";

import { useActionState, useState } from "react";
import { addSeriesItem, type ActionState } from "@/app/series/actions";
import { MAX_SERIES_ITEM_LABEL_LENGTH } from "@/lib/series";

// Re-adding a slot someone else already entered (same normalised label)
// just returns the existing one instead of duplicating it — see
// addSeriesItem.
export function AddSeriesItemForm({ seriesId }: { seriesId: string }) {
  const action = addSeriesItem.bind(null, seriesId);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, { status: "idle" });
  const [showForm, setShowForm] = useState(false);

  const [prevState, setPrevState] = useState(state);
  if (state !== prevState) {
    setPrevState(state);
    if (state.status === "ok") setShowForm(false);
  }

  if (!showForm) {
    return (
      <button type="button" onClick={() => setShowForm(true)} className="text-sm text-blue-600 hover:underline">
        + Add a pin to this series
      </button>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-2 rounded-md border border-neutral-200 bg-neutral-50 p-3 sm:flex-row sm:items-end">
      <div className="flex flex-col gap-1">
        <label htmlFor="item-position" className="text-xs font-medium text-neutral-600">
          # (optional)
        </label>
        <input
          id="item-position"
          name="position"
          type="number"
          min={1}
          className="w-20 rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
        />
      </div>
      <div className="flex flex-1 flex-col gap-1">
        <label htmlFor="item-label" className="text-xs font-medium text-neutral-600">
          Name
        </label>
        <input
          id="item-label"
          name="label"
          type="text"
          maxLength={MAX_SERIES_ITEM_LABEL_LENGTH}
          placeholder="e.g. Donut"
          className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
        />
      </div>
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Add"}
        </button>
        <button
          type="button"
          onClick={() => setShowForm(false)}
          disabled={pending}
          className="rounded-md px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-100 disabled:opacity-60"
        >
          Cancel
        </button>
      </div>
      {state.status === "error" && <p className="text-xs text-red-600 sm:self-center">{state.message}</p>}
    </form>
  );
}
