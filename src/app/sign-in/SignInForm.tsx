"use client";

import { useActionState } from "react";
import { sendMagicLink } from "./actions";

export function SignInForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState(sendMagicLink, { status: "idle" as const });

  if (state.status === "sent") {
    return <p className="text-neutral-700">Check your email for a sign-in link.</p>;
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {next && <input type="hidden" name="next" value={next} />}
      <input
        name="email"
        type="email"
        required
        placeholder="you@example.com"
        className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
        aria-label="Email address"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
      >
        {pending ? "Sending…" : "Send me a sign-in link"}
      </button>
      {state.status === "error" && <p className="text-sm text-red-600">{state.message}</p>}
    </form>
  );
}
