"use client";

import { useActionState } from "react";
import { updateProfile, type ActionState } from "./actions";

export function ProfileForm({
  initialUsername,
  initialFirstName,
  initialLastName,
  initialCity,
}: {
  initialUsername: string;
  initialFirstName: string;
  initialLastName: string;
  initialCity: string;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(updateProfile, { status: "idle" });

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        Username
        <input
          type="text"
          name="username"
          required
          defaultValue={initialUsername}
          className="rounded-md border border-neutral-300 px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        First name <span className="text-neutral-400">(optional)</span>
        <input
          type="text"
          name="firstName"
          defaultValue={initialFirstName}
          className="rounded-md border border-neutral-300 px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Last name <span className="text-neutral-400">(optional)</span>
        <input
          type="text"
          name="lastName"
          defaultValue={initialLastName}
          className="rounded-md border border-neutral-300 px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        City where you live <span className="text-neutral-400">(optional, private — only you can see this)</span>
        <input
          type="text"
          name="city"
          defaultValue={initialCity}
          className="rounded-md border border-neutral-300 px-3 py-2"
        />
      </label>
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
