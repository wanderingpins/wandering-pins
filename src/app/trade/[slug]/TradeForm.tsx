"use client";

import { useActionState } from "react";
import { initiateTrade, type TradeState } from "./actions";

export function TradeForm({ slug }: { slug: string }) {
  const action = initiateTrade.bind(null, slug);
  const [state, formAction, pending] = useActionState<TradeState, FormData>(action, {
    status: "idle",
  });

  if (state.status === "sent") {
    return (
      <p className="text-neutral-700">
        Trade logged. They can claim it as soon as they sign in — no need to wait on them.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        Who did you trade it to?
        <input
          type="email"
          name="toEmail"
          required
          placeholder="their@email.com"
          className="rounded-md border border-neutral-300 px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Where did the trade happen?
        <input
          type="text"
          name="place"
          required
          placeholder="Orlando, FL"
          className="rounded-md border border-neutral-300 px-3 py-2"
        />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
      >
        {pending ? "Logging…" : "Log this trade"}
      </button>
      {state.status === "error" && <p className="text-sm text-red-600">{state.message}</p>}
    </form>
  );
}
