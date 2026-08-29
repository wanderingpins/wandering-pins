"use client";

import { useActionState } from "react";
import { findOrCreateSeries, type ActionState } from "@/app/series/actions";
import { MAX_SERIES_NAME_LENGTH } from "@/lib/series";

// Typing an existing series' name (any casing/whitespace) lands you on that
// same series instead of forking the catalog — see findOrCreateSeries.
export function CreateSeriesForm({ linkPin }: { linkPin?: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(findOrCreateSeries, { status: "idle" });

  return (
    <form action={formAction} className="flex flex-col gap-2">
      {linkPin && <input type="hidden" name="linkPin" value={linkPin} />}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex flex-1 flex-col gap-1">
          <label htmlFor="series-name" className="text-xs font-medium text-neutral-600">
            Start or find a series
          </label>
          <input
            id="series-name"
            name="name"
            type="text"
            maxLength={MAX_SERIES_NAME_LENGTH}
            placeholder="e.g. Dungeon Crawler Carl Blind Box Series"
            className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {pending ? "Working…" : "Go"}
        </button>
      </div>
      {state.status === "error" && <p className="text-xs text-red-600">{state.message}</p>}
    </form>
  );
}
