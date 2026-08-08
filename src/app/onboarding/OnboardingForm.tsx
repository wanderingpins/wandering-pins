"use client";

import { useActionState } from "react";
import { completeOnboarding, type OnboardingState } from "./actions";

export function OnboardingForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState<OnboardingState, FormData>(completeOnboarding, {
    status: "idle",
  });

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {next && <input type="hidden" name="next" value={next} />}

      <label className="flex flex-col gap-1 text-sm">
        Username
        <input
          type="text"
          name="username"
          required
          placeholder="pin_collector"
          className="rounded-md border border-neutral-300 px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Password
        <input
          type="password"
          name="password"
          required
          minLength={8}
          className="rounded-md border border-neutral-300 px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Confirm password
        <input
          type="password"
          name="confirmPassword"
          required
          minLength={8}
          className="rounded-md border border-neutral-300 px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        First name <span className="text-neutral-400">(optional)</span>
        <input type="text" name="firstName" className="rounded-md border border-neutral-300 px-3 py-2" />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Last name <span className="text-neutral-400">(optional)</span>
        <input type="text" name="lastName" className="rounded-md border border-neutral-300 px-3 py-2" />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        City where you live <span className="text-neutral-400">(optional, private — only you can see this)</span>
        <input
          type="text"
          name="city"
          placeholder="Orlando, FL"
          className="rounded-md border border-neutral-300 px-3 py-2"
        />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
      >
        {pending ? "Saving…" : "Continue"}
      </button>
      {state.status === "error" && <p className="text-sm text-red-600">{state.message}</p>}
    </form>
  );
}
