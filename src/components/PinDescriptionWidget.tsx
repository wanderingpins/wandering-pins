"use client";

import { useActionState } from "react";
import { updateDescription, type ActionState } from "@/app/holdings/[holdingId]/actions";
import { useEditMode } from "@/components/PinEditMode";

// The pin's public description, on the torn paper note. Only ever rendered for
// the current holder (gated by the caller — PinNote, from /p/[number]). Outside
// edit mode it's just the handwritten text; once the owner presses the "Edit
// pin information" sticker the textarea is there straight away, with no second
// "Edit" click.
export function PinDescriptionWidget({
  holdingId,
  initialDescription,
}: {
  holdingId: string;
  initialDescription: string;
}) {
  const editing = useEditMode();

  if (!editing) {
    return <p className="whitespace-pre-wrap font-hand text-[22px] leading-7 text-ink">{initialDescription}</p>;
  }
  return <DescriptionForm holdingId={holdingId} initialDescription={initialDescription} />;
}

// Its own component so leaving edit mode unmounts it, which resets the
// "Saved." message instead of showing a stale one next time.
//
// Colors are ink-on-paper rather than the app's navy-theme neutrals, and every
// row is 28px (leading-7) to sit on the paper's ruled lines.
function DescriptionForm({ holdingId, initialDescription }: { holdingId: string; initialDescription: string }) {
  const action = updateDescription.bind(null, holdingId);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, { status: "idle" });

  return (
    <form action={formAction} className="flex flex-col">
      <p className="font-sans text-xs leading-7 text-ink/60">🌐 Shown publicly on this pin&apos;s page.</p>
      <textarea
        name="description"
        rows={4}
        defaultValue={initialDescription}
        placeholder="Tell visitors about this pin (optional)"
        className="w-full resize-none bg-transparent font-hand text-[22px] leading-7 text-ink placeholder:text-ink/40 focus:outline-none"
      />
      <div className="flex items-center gap-2 py-0.5">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-brand px-3 py-1 font-sans text-xs font-medium text-white hover:bg-brand-hover disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        {state.status === "ok" && <span className="font-sans text-xs text-ink/60">Saved.</span>}
      </div>
      {state.status === "error" && <p className="font-sans text-xs leading-7 text-red-700">{state.message}</p>}
    </form>
  );
}
