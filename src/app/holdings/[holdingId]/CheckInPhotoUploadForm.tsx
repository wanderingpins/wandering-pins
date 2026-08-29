"use client";

import { useActionState, useRef, useState } from "react";
import type { Area } from "react-easy-crop";
import { uploadCheckInPhoto, type ActionState } from "./checkin-actions";
import { PhotoCropModal } from "./PhotoCropModal";
import { cropPhotoToBlob } from "@/lib/crop-photo";
import { MAX_CHECKIN_PHOTOS } from "@/lib/photo-limits";

// Same raw-selection sanity check as PhotoUploadForm — not the real limit,
// see photo-limits.ts for that.
const MAX_SELECTION_BYTES = 25 * 1024 * 1024;

export function CheckInPhotoUploadForm({ checkInId, photoCount }: { checkInId: string; photoCount: number }) {
  const action = uploadCheckInPhoto.bind(null, checkInId);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, { status: "idle" });
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [pickError, setPickError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const atLimit = photoCount >= MAX_CHECKIN_PHOTOS;

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
    setPickError(null);
    if (!file.type.startsWith("image/")) {
      setPickError("Please choose an image file.");
      return;
    }
    if (file.size > MAX_SELECTION_BYTES) {
      setPickError("That photo is too large — please choose a smaller one.");
      return;
    }
    setImageSrc(URL.createObjectURL(file));
  }

  function closeCropper() {
    if (imageSrc) URL.revokeObjectURL(imageSrc);
    setImageSrc(null);
  }

  async function handleCropConfirm(croppedAreaPixels: Area) {
    if (!imageSrc) return;
    let blob: Blob;
    try {
      blob = await cropPhotoToBlob(imageSrc, croppedAreaPixels);
    } catch {
      setPickError("Couldn't process that photo. Please try again.");
      closeCropper();
      return;
    }
    const formData = new FormData();
    formData.set("photo", new File([blob], "photo.jpg", { type: "image/jpeg" }));
    closeCropper();
    formAction(formData);
  }

  if (atLimit) {
    return <p className="text-xs text-neutral-500">You&apos;ve added the max of {MAX_CHECKIN_PHOTOS} photos here.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => openPicker("environment")}
          disabled={pending}
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-60"
        >
          Take a photo
        </button>
        <button
          type="button"
          onClick={() => openPicker()}
          disabled={pending}
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-60"
        >
          Choose from library
        </button>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileChange}
        className="hidden"
      />

      {pending && <p className="text-xs text-neutral-500">Uploading…</p>}
      {pickError && <p className="text-xs text-red-600">{pickError}</p>}
      {state.status === "error" && <p className="text-xs text-red-600">{state.message}</p>}

      {imageSrc && (
        <PhotoCropModal imageSrc={imageSrc} onCancel={closeCropper} onConfirm={handleCropConfirm} pending={pending} />
      )}
    </div>
  );
}
