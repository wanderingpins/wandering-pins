"use client";

import { useRef } from "react";
import { useFormStatus } from "react-dom";

export type PinOption = { id: string; label: string };

// "Your pin: [#13 Darren ▾]" under a series design you've claimed: picks which
// of your own pins it is, which is what makes that pin's page say "Part of a
// series". Saves as soon as you pick (the action is setClaimLinkedPin).
export function LinkedPinSelect({
  action,
  options,
  value,
  itemLabel,
}: {
  action: (formData: FormData) => void | Promise<void>;
  options: PinOption[];
  value: string;
  itemLabel: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <form ref={formRef} action={action} className="flex w-full flex-col items-center gap-1">
      <label className="flex w-full flex-col items-center gap-1 text-xs text-neutral-600">
        <span>Which of your pins is it?</span>
        <select
          name="pinId"
          defaultValue={value}
          aria-label={`Which of your pins is ${itemLabel}`}
          onChange={() => formRef.current?.requestSubmit()}
          className="w-full max-w-[12rem] rounded-md border border-neutral-300 bg-panel px-2 py-1.5 text-xs text-neutral-800"
        >
          <option value="">Not linked to a pin</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <Saving />
    </form>
  );
}

function Saving() {
  const { pending } = useFormStatus();
  return pending ? <span className="text-xs text-neutral-500">Saving…</span> : null;
}
