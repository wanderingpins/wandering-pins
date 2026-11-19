"use client";

import { useActionState, useRef, useState, startTransition } from "react";
import type { Area } from "react-easy-crop";
import { MAX_DESCRIPTION_LENGTH, MAX_STORY_LENGTH, MAX_TITLE_LENGTH, type RegisterState } from "@/lib/register-form";
import { PlacePrivacyChoices } from "@/components/PlacePrivacyChoices";
import { PhotoCropModal } from "@/app/holdings/[holdingId]/PhotoCropModal";
import { cropPhotoToBlob } from "@/lib/crop-photo";

const ACQUIRED_VIA_OPTIONS = [
  { value: "BOUGHT", label: "Bought it" },
  { value: "TRADED", label: "Traded for it" },
  { value: "GIFT", label: "Got it as a gift" },
  { value: "FOUND", label: "Found it" },
  { value: "OTHER", label: "Other" },
] as const;

// Same raw-selection sanity check as PhotoUploadForm — not the real limit.
const MAX_SELECTION_BYTES = 25 * 1024 * 1024;

const INPUT = "rounded-md border border-neutral-300 px-3 py-2";

// The new-pin form, bound to whichever server action the page wants —
// registering with a sticker, or adding a pin that has none yet. Top to
// bottom: the pin's public face (name, description, photo), then how/when/
// where with its privacy choices, then the story (private unless shared).
export function PinRegistrationForm({
  action,
  submitLabel = "Register this pin",
  pendingLabel = "Registering…",
  defaultRegionOnly = false,
}: {
  action: (prevState: RegisterState, formData: FormData) => Promise<RegisterState>;
  submitLabel?: string;
  pendingLabel?: string;
  /** The user's "Always show my places as the state" setting. */
  defaultRegionOnly?: boolean;
}) {
  const [state, formAction, pending] = useActionState<RegisterState, FormData>(action, {
    status: "idle",
  });

  // The photo is picked and cropped here, then added to the form data on
  // submit (the file input itself has no name, so the raw camera file is
  // never sent).
  const [photo, setPhoto] = useState<{ file: File; preview: string } | null>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Two explicit buttons, like the other photo pickers: newer Android phones
  // open a gallery-only picker for a plain image input, so the camera needs
  // its own button that sets `capture` before opening.
  function openPicker(capture?: "environment") {
    const input = fileInputRef.current;
    if (!input) return;
    if (capture) input.setAttribute("capture", capture);
    else input.removeAttribute("capture");
    input.click();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setPhotoError(null);
    if (!file.type.startsWith("image/")) return setPhotoError("Please choose an image file.");
    if (file.size > MAX_SELECTION_BYTES) return setPhotoError("That photo is too large — please choose a smaller one.");
    setCropSrc(URL.createObjectURL(file));
  }

  function closeCropper() {
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
  }

  async function handleCropConfirm(area: Area) {
    if (!cropSrc) return;
    try {
      const blob = await cropPhotoToBlob(cropSrc, area);
      if (photo) URL.revokeObjectURL(photo.preview);
      setPhoto({ file: new File([blob], "pin.jpg", { type: "image/jpeg" }), preview: URL.createObjectURL(blob) });
    } catch {
      setPhotoError("Couldn't process that photo. Please try again.");
    }
    closeCropper();
  }

  function removePhoto() {
    if (photo) URL.revokeObjectURL(photo.preview);
    setPhoto(null);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    if (photo) formData.set("photo", photo.file);
    startTransition(() => formAction(formData));
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {/* The pin's public face */}
      <label className="flex flex-col gap-1 text-sm">
        <span>
          Give it a name <PublicTag />
        </span>
        <input type="text" name="title" maxLength={MAX_TITLE_LENGTH} placeholder="Shredhead" className={INPUT} />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span>
          Description <PublicTag />
        </span>
        <textarea
          name="description"
          rows={3}
          maxLength={MAX_DESCRIPTION_LENGTH}
          placeholder="What it looks like, what it's from…"
          className={INPUT}
        />
        <span className="text-xs text-neutral-500">Shown on the pin&apos;s page while you have it.</span>
      </label>

      <div className="flex flex-col gap-2 text-sm">
        <span>
          Photo <PublicTag />
        </span>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
        {photo ? (
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- a local blob preview */}
            <img src={photo.preview} alt="Your pin" className="size-24 rounded-md object-cover ring-2 ring-gold" />
            <div className="flex flex-col items-start gap-1">
              <button type="button" onClick={() => openPicker("environment")} className="text-accent hover:underline">
                📷 Take a new photo
              </button>
              <button type="button" onClick={() => openPicker()} className="text-accent hover:underline">
                🖼️ Choose a different photo
              </button>
              <button type="button" onClick={removePhoto} className="text-neutral-500 hover:text-red-600 hover:underline">
                Remove photo
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => openPicker("environment")}
              className="rounded-md border border-dashed border-neutral-300 px-4 py-3 text-neutral-700 hover:bg-neutral-50"
            >
              📷 Take a photo
            </button>
            <button
              type="button"
              onClick={() => openPicker()}
              className="rounded-md border border-dashed border-neutral-300 px-4 py-3 text-neutral-700 hover:bg-neutral-50"
            >
              🖼️ Choose from library
            </button>
          </div>
        )}
        <span className="text-xs text-neutral-500">
          Shown on the pin&apos;s page and on Browse pins while you have it.
        </span>
        {photoError && <span className="text-xs text-red-600">{photoError}</span>}
      </div>

      {/* How, when, where */}
      <label className="flex flex-col gap-1 text-sm">
        How did you get it?
        <select name="acquiredVia" required className={INPUT}>
          {ACQUIRED_VIA_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Roughly when?
        <input type="date" name="acquiredAt" required className={INPUT} />
      </label>

      <div className="flex flex-col gap-2">
        <label className="flex flex-col gap-1 text-sm">
          Where? (city is enough)
          <input type="text" name="place" required placeholder="Orlando, FL" className={INPUT} />
        </label>
        <p className="text-xs text-neutral-500">
          🛡️ Only the general city is ever shown, never an address or your exact location. Tick &quot;Only show the
          state&quot; below to show even less.
        </p>
        <PlacePrivacyChoices defaultRegionOnly={defaultRegionOnly} withPrivate />
      </div>

      {/* The story */}
      <div className="flex flex-col gap-2">
        <label className="flex flex-col gap-1 text-sm">
          <span>
            Tell the story <PrivateTag />
          </span>
          <textarea
            name="notes"
            rows={4}
            maxLength={MAX_STORY_LENGTH}
            placeholder="Where you got it, who you traded with, why it matters to you…"
            className={INPUT}
          />
          <span className="text-xs text-neutral-500">
            This is for you to tell about getting the pin. Only you can see it unless you share it below.
          </span>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="storyPublic" className="mt-0.5 size-4" />
          <span>
            Share my story on the pin&apos;s page
            <span className="block text-xs text-neutral-500">
              Anyone can read it there while you have the pin. You can change this later.
            </span>
          </span>
        </label>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-60"
      >
        {pending ? pendingLabel : submitLabel}
      </button>
      {state.status === "error" && <p className="text-sm text-red-600">{state.message}</p>}

      {cropSrc && <PhotoCropModal imageSrc={cropSrc} onCancel={closeCropper} onConfirm={handleCropConfirm} pending={false} />}
    </form>
  );
}

function PublicTag() {
  return <span className="ml-1 text-xs text-neutral-500">🌐 Public</span>;
}

function PrivateTag() {
  return <span className="ml-1 text-xs text-neutral-500">🔒 Private unless you share it</span>;
}
