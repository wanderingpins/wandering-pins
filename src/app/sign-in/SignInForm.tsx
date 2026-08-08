"use client";

import { useActionState, useState } from "react";
import { sendMagicLink, signInWithPassword } from "./actions";

export function SignInForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState(sendMagicLink, { status: "idle" as const });
  const [showPassword, setShowPassword] = useState(false);
  const [passwordState, passwordFormAction, passwordPending] = useActionState(signInWithPassword, {
    status: "idle" as const,
  });

  if (state.status === "sent") {
    return <p className="text-neutral-700">Check your email for a sign-in link.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
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

      {showPassword ? (
        <form action={passwordFormAction} className="flex flex-col gap-3 border-t border-neutral-200 pt-4">
          {next && <input type="hidden" name="next" value={next} />}
          <input
            name="email"
            type="email"
            required
            placeholder="you@example.com"
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
            aria-label="Email address"
          />
          <input
            name="password"
            type="password"
            required
            placeholder="Password"
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
            aria-label="Password"
          />
          <button
            type="submit"
            disabled={passwordPending}
            className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-60"
          >
            {passwordPending ? "Signing in…" : "Sign in with password"}
          </button>
          {passwordState.status === "error" && <p className="text-sm text-red-600">{passwordState.message}</p>}
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setShowPassword(true)}
          className="text-left text-sm text-neutral-500 underline hover:text-neutral-700"
        >
          Already set a password? Sign in with it instead
        </button>
      )}
    </div>
  );
}
