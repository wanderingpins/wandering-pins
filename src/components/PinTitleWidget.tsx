"use client";

import { useActionState } from "react";
import { updateTitle, type ActionState } from "@/app/holdings/[holdingId]/actions";
import { PinNamePill } from "@/components/PinNamePill";
import { useEditMode } from "@/components/PinEditMode";

// The pin's name pill on /p/[slug]. Only ever rendered with a holdingId for the
// current holder (gated by the caller). Outside edit mode it's just the pill;
// once the owner presses the "Edit pin information" sticker the name becomes a
// field inside the pill, with a Save button under it.
export function PinTitleWidget({ holdingId, title }: { holdingId: string; title: string }) {
  const editing = useEditMode();

  if (!editing) return <PinNamePill>{title}</PinNamePill>;
  return <TitleForm holdingId={holdingId} title={title} />;
}

// Its own component so leaving edit mode unmounts it, which resets the
// "Saved." message instead of showing a stale one next time.
function TitleForm({ holdingId, title }: { holdingId: string; title: string }) {
  const action = updateTitle.bind(null, holdingId);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, { status: "idle" });

  return (
    <form action={formAction} className="flex w-full max-w-full flex-col items-center gap-3">
      <PinNamePill>
        <input
          name="title"
          type="text"
          defaultValue={title === "Untitled Pin" ? "" : title}
          placeholder="Name this pin"
          aria-label="Pin name"
          maxLength={80}
          className="w-[min(70vw,26rem)] border-b-2 border-dashed border-cream/50 bg-transparent text-center uppercase tracking-[0.18em] text-cream placeholder:text-cream/50 focus:border-cream focus:outline-none"
        />
      </PinNamePill>
      <p className="text-xs font-medium text-cork-ink">🌐 Shown publicly on this pin&apos;s page.</p>
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-brand px-3 py-1 text-xs font-medium text-white hover:bg-brand-hover disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save name"}
        </button>
        {state.status === "ok" && <span className="text-xs font-medium text-cork-ink">Saved.</span>}
      </div>
      {state.status === "error" && <p className="text-xs font-medium text-red-800">{state.message}</p>}
    </form>
  );
}
