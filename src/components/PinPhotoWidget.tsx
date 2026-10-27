"use client";

import { useActionState, useRef, useState } from "react";
import type { Area } from "react-easy-crop";
import { uploadPhoto, deletePhoto, type ActionState } from "@/app/holdings/[holdingId]/actions";
import { PhotoCropModal } from "@/app/holdings/[holdingId]/PhotoCropModal";
import { PinPhotoFrame } from "@/components/PinPhotoFrame";
import { cropPhotoToBlob } from "@/lib/crop-photo";

// Same raw-selection sanity check as PhotoUploadForm — not the real limit,
// see photo-limits.ts for that.
const MAX_SELECTION_BYTES = 25 * 1024 * 1024;

// The pin's own main photo (the FRONT-kind photo on the current holder's
// open holding) — deliberately its own top-of-page control, not nested
// under the "Bought in..." line's details, so it doesn't read as if it
// belongs to that one acquisition event. This is the one photo on the
// whole page that's genuinely public (brief section 7's narrow, explicit
// exception) — everything InlineHoldingDetails/InlineCheckInDetails manage
// stays private.
export function PinPhotoWidget({
  holdingId,
  slug,
  frontPhotoId,
  publicTitle,
  pinColor,
}: {
  holdingId: string;
  slug: string;
  frontPhotoId?: string;
  publicTitle: string;
  pinColor?: string;
}) {
  const [showUpload, setShowUpload] = useState(false);

  const uploadAction = uploadPhoto.bind(null, holdingId);
  const [uploadState, uploadFormAction, uploadPending] = useActionState<ActionState, FormData>(uploadAction, {
    status: "idle",
  });

  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [pickError, setPickError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Adjust state during render rather than in an effect (same pattern used
  // elsewhere on this page) — a fresh upload always returns a new state
  // object, so comparing the object itself (not just its status string)
  // catches a second upload in a row too.
  const [prevUploadState, setPrevUploadState] = useState(uploadState);
  if (uploadState !== prevUploadState) {
    setPrevUploadState(uploadState);
    if (uploadState.status === "ok") setShowUpload(false);
  }

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
    formData.set("kind", "FRONT");
    formData.set("photo", new File([blob], "photo.jpg", { type: "image/jpeg" }));
    closeCropper();
    uploadFormAction(formData);
  }

  // Sits on the cork board (page.tsx): the photo itself is a tilted print, and
  // the owner's controls are navy chips beneath it so they stay legible on cork.
  const chip = "rounded-full bg-navy/90 px-3 py-1 text-xs font-medium shadow hover:bg-navy";

  return (
    <div className="flex flex-col items-center gap-4">
      {frontPhotoId && !showUpload ? (
        <>
          <PinPhotoFrame pinColor={pinColor}>
            {/* eslint-disable-next-line @next/next/no-img-element -- served through a dedicated public route, not a static asset next/image can optimize */}
            <img src={`/api/pins/${slug}/photo`} alt={publicTitle} className="size-56 object-cover" />
          </PinPhotoFrame>
          <div className="flex gap-2">
            <button type="button" onClick={() => setShowUpload(true)} className={`${chip} text-accent`}>
              Replace photo
            </button>
            <form action={deletePhoto.bind(null, holdingId, frontPhotoId)}>
              <button type="submit" className={`${chip} text-red-600`}>
                Remove
              </button>
            </form>
          </div>
        </>
      ) : !showUpload ? (
        <PinPhotoFrame pinColor={pinColor}>
          <div className="flex size-56 flex-col items-center justify-center gap-2 bg-navy p-4 text-center">
            <p className="text-sm text-neutral-500">Pin photo not available</p>
            <button
              type="button"
              onClick={() => setShowUpload(true)}
              className="rounded-md border border-neutral-300 bg-panel px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
            >
              Add pin photo
            </button>
          </div>
        </PinPhotoFrame>
      ) : (
        <div className="flex max-w-xs flex-col gap-2 rounded-lg border border-neutral-200 bg-navy p-3 shadow-lg">
          <p className="text-xs text-neutral-500">🌐 Shown publicly on this pin&apos;s page.</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => openPicker("environment")}
              disabled={uploadPending}
              className="rounded-md border border-neutral-300 bg-panel px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-60"
            >
              Take a photo
            </button>
            <button
              type="button"
              onClick={() => openPicker()}
              disabled={uploadPending}
              className="rounded-md border border-neutral-300 bg-panel px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-60"
            >
              Choose from library
            </button>
          </div>
          <button
            type="button"
            onClick={() => setShowUpload(false)}
            disabled={uploadPending}
            className="self-start text-xs text-neutral-500 hover:underline disabled:opacity-60"
          >
            Cancel
          </button>
          {uploadPending && <p className="text-xs text-neutral-500">Uploading…</p>}
          {pickError && <p className="text-xs text-red-600">{pickError}</p>}
          {uploadState.status === "error" && <p className="text-xs text-red-600">{uploadState.message}</p>}
        </div>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileChange}
        className="hidden"
      />
      {imageSrc && (
        <PhotoCropModal imageSrc={imageSrc} onCancel={closeCropper} onConfirm={handleCropConfirm} pending={uploadPending} />
      )}
    </div>
  );
}
