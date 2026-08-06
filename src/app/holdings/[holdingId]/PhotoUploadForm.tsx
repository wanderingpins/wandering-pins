"use client";

import { useActionState, useRef } from "react";
import { uploadPhoto, type ActionState } from "./actions";

export function PhotoUploadForm({ holdingId }: { holdingId: string }) {
  const action = uploadPhoto.bind(null, holdingId);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, { status: "idle" });
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={async (formData) => {
        await formAction(formData);
        formRef.current?.reset();
      }}
      className="flex flex-col gap-3"
    >
      <label className="flex flex-col gap-1 text-sm">
        Which side?
        <select name="kind" className="rounded-md border border-neutral-300 px-3 py-2">
          <option value="FRONT">Front</option>
          <option value="BACK">Back</option>
          <option value="OTHER">Other</option>
        </select>
      </label>
      <input type="file" name="photo" accept="image/jpeg,image/png,image/webp" required />
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
      >
        {pending ? "Uploading…" : "Add photo"}
      </button>
      {state.status === "error" && <p className="text-sm text-red-600">{state.message}</p>}
    </form>
  );
}
