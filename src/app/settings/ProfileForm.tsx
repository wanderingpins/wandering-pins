"use client";

import { useActionState, useState } from "react";
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
  const [editing, setEditing] = useState(false);

  // Adjust state during render rather than in an effect (React's recommended
  // pattern for "respond to a value changing"). A successful save means the
  // props above already reflect the new values (revalidatePath re-renders
  // the server-rendered page) — drop back to the read-only view rather than
  // leaving the form open with a "Saved." aside. Compares the state
  // *object* itself, not just its status string: editing again and saving
  // a second time still returns a fresh { status: "ok" } object, but the
  // status string alone would look unchanged from the last render and
  // never re-trigger the collapse.
  const [prevState, setPrevState] = useState(state);
  if (state !== prevState) {
    setPrevState(state);
    if (state.status === "ok") setEditing(false);
  }

  if (!editing) {
    return (
      <div className="flex flex-col gap-3">
        <dl className="flex flex-col gap-2 text-sm">
          <div>
            <dt className="text-neutral-500">Username</dt>
            <dd className="font-medium text-neutral-900">{initialUsername}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">First name</dt>
            <dd className="text-neutral-900">{initialFirstName || <span className="text-neutral-400">Not set</span>}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Last name</dt>
            <dd className="text-neutral-900">{initialLastName || <span className="text-neutral-400">Not set</span>}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">
              City where you live <span className="text-neutral-400">(private — only you can see this)</span>
            </dt>
            <dd className="text-neutral-900">{initialCity || <span className="text-neutral-400">Not set</span>}</dd>
          </div>
        </dl>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="self-start rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
        >
          Edit
        </button>
      </div>
    );
  }

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
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save"}
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
  );
}
