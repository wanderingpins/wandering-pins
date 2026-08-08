"use client";

import { useActionState } from "react";
import { requestEmailChange, type EmailChangeState } from "./actions";

export function EmailForm({ currentEmail }: { currentEmail: string }) {
  const [state, formAction, pending] = useActionState<EmailChangeState, FormData>(requestEmailChange, {
    status: "idle",
  });

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <p className="text-sm text-neutral-600">
        Current email: <span className="font-medium text-neutral-900">{currentEmail}</span>
      </p>
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
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
      >
        {pending ? "Sending…" : "Change email"}
      </button>
      {state.status === "pending" && (
        <p className="text-sm text-green-700">Check {state.message} for a confirmation link — nothing changes until you click it.</p>
      )}
      {state.status === "error" && <p className="text-sm text-red-600">{state.message}</p>}
    </form>
  );
}
