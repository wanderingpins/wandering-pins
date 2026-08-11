"use client";

import { useActionState, useRef, useState } from "react";
import type { Area } from "react-easy-crop";
import { uploadPhoto, type ActionState } from "./actions";
import { PhotoCropModal } from "./PhotoCropModal";
import { cropPhotoToBlob } from "@/lib/crop-photo";

type Kind = "FRONT" | "BACK" | "OTHER";

// A raw camera photo can be much larger than what we'll ever upload — this
// is just a sanity check before we bother decoding it into a canvas, not the
// real size limit (that's enforced after cropping, see photo-limits.ts).
const MAX_SELECTION_BYTES = 25 * 1024 * 1024;

export function PhotoUploadForm({ holdingId }: { holdingId: string }) {
  const action = uploadPhoto.bind(null, holdingId);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, { status: "idle" });
  const [kind, setKind] = useState<Kind>("FRONT");
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [pickError, setPickError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function openPicker(capture?: "environment") {
    const input = fileInputRef.current;
    if (!input) return;
    if (capture) input.setAttribute("capture", capture);
    else input.removeAttribute("capture");
    input.click();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // so picking the same file again later still fires this handler
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
    formData.set("kind", kind);
    formData.set("photo", new File([blob], "photo.jpg", { type: "image/jpeg" }));
    closeCropper();
    formAction(formData);
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        Which side?
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as Kind)}
          className="rounded-md border border-neutral-300 px-3 py-2"
        >
          <option value="FRONT">Front</option>
          <option value="BACK">Back</option>
          <option value="OTHER">Other</option>
        </select>
      </label>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => openPicker("environment")}
          disabled={pending}
          className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-60"
        >
          Take a photo
        </button>
        <button
          type="button"
          onClick={() => openPicker()}
          disabled={pending}
          className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-60"
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

      {pending && <p className="text-sm text-neutral-500">Uploading…</p>}
      {pickError && <p className="text-sm text-red-600">{pickError}</p>}
      {state.status === "error" && <p className="text-sm text-red-600">{state.message}</p>}

      {imageSrc && (
        <PhotoCropModal imageSrc={imageSrc} onCancel={closeCropper} onConfirm={handleCropConfirm} pending={pending} />
      )}
    </div>
  );
}
