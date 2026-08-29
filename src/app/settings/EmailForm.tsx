"use client";

import { useActionState, useState } from "react";
import { requestEmailChange, type EmailChangeState } from "./actions";

export function EmailForm({ currentEmail }: { currentEmail: string }) {
  const [state, formAction, pending] = useActionState<EmailChangeState, FormData>(requestEmailChange, {
    status: "idle",
  });
  const [editing, setEditing] = useState(false);

  // Adjust state during render rather than in an effect (React's recommended
  // pattern for "respond to a value changing"). A successful request doesn't
  // change currentEmail yet (nothing does until the confirmation link is
  // clicked) — collapse back to the view either way, and let the pending
  // notice below stand on its own regardless of editing state. Compares the
  // state *object* itself, not just its status string: requesting a second
  // change still returns a fresh { status: "pending" } object, but the
  // status string alone would look unchanged from the last render and
  // never re-trigger the collapse.
  const [prevState, setPrevState] = useState(state);
  if (state !== prevState) {
    setPrevState(state);
    if (state.status === "pending") setEditing(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-neutral-600">
        Current email: <span className="font-medium text-neutral-900">{currentEmail}</span>
      </p>

      {editing ? (
        <form action={formAction} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm">
            New email
            <input
              type="email"
              name="email"
              required
              placeholder="you@example.com"
              className="rounded-md border border-neutral-300 px-3 py-2"
            />
          </label>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {pending ? "Sending…" : "Change email"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              disabled={pending}
              className="rounded-md px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-50 disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
          {state.status === "error" && <p className="text-sm text-red-600">{state.message}</p>}
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="self-start rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
        >
          Change email
        </button>
      )}

      {state.status === "pending" && (
        <p className="text-sm text-green-700">Check {state.message} for a confirmation link — nothing changes until you click it.</p>
      )}
    </div>
  );
}
