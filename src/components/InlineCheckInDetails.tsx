"use client";

import { useActionState, useRef, useState } from "react";
import type { Area } from "react-easy-crop";
import {
  updateCheckInNote,
  uploadCheckInPhoto,
  deleteCheckInPhoto,
  type ActionState,
} from "@/app/holdings/[holdingId]/checkin-actions";
import { PhotoCropModal } from "@/app/holdings/[holdingId]/PhotoCropModal";
import { cropPhotoToBlob } from "@/lib/crop-photo";
import { MAX_CHECKIN_PHOTOS } from "@/lib/photo-limits";

// Same raw-selection sanity check as PhotoUploadForm — not the real limit,
// see photo-limits.ts for that.
const MAX_SELECTION_BYTES = 25 * 1024 * 1024;

// Inline "add details" for one check-in's journey line, shown only to that
// check-in's owner (gated by the caller — /app/p/[slug]/page.tsx). Same
// shape as InlineHoldingDetails — check-in photos have no `kind`, always
// private, capped at MAX_CHECKIN_PHOTOS.
export function InlineCheckInDetails({
  checkInId,
  initialNotes,
  photos,
}: {
  checkInId: string;
  initialNotes: string;
  photos: { id: string }[];
}) {
  const [expanded, setExpanded] = useState(false);
  const hasDetails = !!initialNotes || photos.length > 0;
  const atPhotoLimit = photos.length >= MAX_CHECKIN_PHOTOS;

  const noteAction = updateCheckInNote.bind(null, checkInId);
  const [noteState, noteFormAction, notePending] = useActionState<ActionState, FormData>(noteAction, { status: "idle" });

  const uploadAction = uploadCheckInPhoto.bind(null, checkInId);
  const [uploadState, uploadFormAction, uploadPending] = useActionState<ActionState, FormData>(uploadAction, {
    status: "idle",
  });

  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [pickError, setPickError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Adjust state during render rather than in an effect (same pattern as
  // the settings page's edit toggle) — collapse back once the note saves.
  // Compares the state *object* itself, not just its status string: a
  // second save in a row still returns a fresh { status: "ok" } object, but
  // the status string alone would look unchanged from the last render and
  // never re-trigger the collapse.
  const [prevNoteState, setPrevNoteState] = useState(noteState);
  if (noteState !== prevNoteState) {
    setPrevNoteState(noteState);
    if (noteState.status === "ok") setExpanded(false);
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
    formData.set("photo", new File([blob], "photo.jpg", { type: "image/jpeg" }));
    closeCropper();
    uploadFormAction(formData);
  }

  return (
    <div className="flex flex-col gap-2">
      {!expanded && hasDetails && (
        <div className="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-neutral-50 p-3">
          <p className="inline-flex w-fit items-center gap-1.5 rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-600">
            🔒 Only you can see this
          </p>
          {initialNotes && <p className="whitespace-pre-wrap text-sm text-neutral-800">{initialNotes}</p>}
          {photos.length > 0 && (
            <ul className="grid grid-cols-4 gap-2">
              {photos.map((photo) => (
                <li key={photo.id}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- private, per-user image behind an auth-gated route */}
                  <img
                    src={`/api/check-ins/${checkInId}/photos/${photo.id}`}
                    alt=""
                    className="aspect-square w-full rounded-md object-cover"
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {!expanded ? (
        <button type="button" onClick={() => setExpanded(true)} className="self-start text-sm text-blue-600 hover:underline">
          {hasDetails ? "Edit details" : "Add details"}
        </button>
      ) : (
        <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-neutral-50 p-3">
          <p className="inline-flex w-fit items-center gap-1.5 rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-600">
            🔒 Only you can see this
          </p>

          <form action={noteFormAction} className="flex flex-col gap-2">
            <textarea
              name="body"
              rows={3}
              defaultValue={initialNotes}
              placeholder="What happened here? (optional)"
              className="rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm"
            />
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={notePending}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {notePending ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                onClick={() => setExpanded(false)}
                disabled={notePending}
                className="rounded-md px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-100 disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
            {noteState.status === "error" && <p className="text-xs text-red-600">{noteState.message}</p>}
          </form>

          {photos.length > 0 && (
            <ul className="grid grid-cols-4 gap-2">
              {photos.map((photo) => (
                <li key={photo.id} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element -- private, per-user image behind an auth-gated route */}
                  <img
                    src={`/api/check-ins/${checkInId}/photos/${photo.id}`}
                    alt=""
                    className="aspect-square w-full rounded-md object-cover"
                  />
                  <form action={deleteCheckInPhoto.bind(null, checkInId, photo.id)} className="absolute right-1 top-1">
                    <button type="submit" className="rounded-full bg-black/60 px-2 py-0.5 text-xs text-white hover:bg-black/80">
                      &times;
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}

          {atPhotoLimit ? (
            <p className="text-xs text-neutral-500">You&apos;ve added the max of {MAX_CHECKIN_PHOTOS} photos here.</p>
          ) : (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => openPicker("environment")}
                disabled={uploadPending}
                className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-60"
              >
                Take a photo
              </button>
              <button
                type="button"
                onClick={() => openPicker()}
                disabled={uploadPending}
                className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-60"
              >
                Choose from library
              </button>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileChange}
            className="hidden"
          />

          {uploadPending && <p className="text-xs text-neutral-500">Uploading…</p>}
          {pickError && <p className="text-xs text-red-600">{pickError}</p>}
          {uploadState.status === "error" && <p className="text-xs text-red-600">{uploadState.message}</p>}

          {imageSrc && (
            <PhotoCropModal imageSrc={imageSrc} onCancel={closeCropper} onConfirm={handleCropConfirm} pending={uploadPending} />
          )}
        </div>
      )}
    </div>
  );
}
