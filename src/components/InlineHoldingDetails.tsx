"use client";

import { useActionState, useRef, useState } from "react";
import { useEditMode } from "@/components/PinEditMode";
import { JournalPhoto } from "@/components/JournalPhoto";
import { journalPhotoTilt } from "@/lib/pin-card-style";
import type { Area } from "react-easy-crop";
import { updateHoldingNote, uploadPhoto, deletePhoto, type ActionState } from "@/app/holdings/[holdingId]/actions";
import { PhotoCropModal } from "@/app/holdings/[holdingId]/PhotoCropModal";
import { cropPhotoToBlob } from "@/lib/crop-photo";

// Same raw-selection sanity check as PhotoUploadForm — not the real limit,
// see photo-limits.ts for that.
const MAX_SELECTION_BYTES = 25 * 1024 * 1024;

type Photo = { id: string };

// Inline "add details" for one journey line, shown only to that line's
// owner (gated by the caller — /app/p/[slug]/page.tsx). Deliberately
// narrower than the full /holdings/[holdingId] page: just a notes textarea
// and photos, no title/release-date picker — and no front/back/other side
// either, since the pin's one public photo now has its own dedicated
// control at the top of the page (PinPhotoWidget). Every photo here is
// always private; the caller is expected to have already filtered out any
// FRONT-kind photo before passing `photos` in.
export function InlineHoldingDetails({
  holdingId,
  initialNotes,
  photos,
}: {
  holdingId: string;
  initialNotes: string;
  photos: Photo[];
}) {
  const [expanded, setExpanded] = useState(false);
  const hasDetails = !!initialNotes || photos.length > 0;
  // Nothing is editable until the owner turns on edit mode (the "Edit pin
  // information" sticker on the pin page); leaving it also collapses an open
  // editor, while the read-only preview of saved notes/photos stays.
  const editing = useEditMode();
  const open = expanded && editing;

  const noteAction = updateHoldingNote.bind(null, holdingId);
  const [noteState, noteFormAction, notePending] = useActionState<ActionState, FormData>(noteAction, { status: "idle" });

  const uploadAction = uploadPhoto.bind(null, holdingId);
  const [uploadState, uploadFormAction, uploadPending] = useActionState<ActionState, FormData>(uploadAction, {
    status: "idle",
  });

  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [pickError, setPickError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Adjust state during render rather than in an effect (same pattern as
  // the settings page's edit toggle) — collapse back once the note saves.
  // Compares the state *object* itself, not just its status string: a
  // second save in a row (e.g. re-opening and saving again with unchanged
  // text) still returns a fresh { status: "ok" } object each time, but the
  // status string would otherwise look unchanged from the last render and
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
    formData.set("kind", "OTHER");
    formData.set("photo", new File([blob], "photo.jpg", { type: "image/jpeg" }));
    closeCropper();
    uploadFormAction(formData);
  }

  return (
    <div className="flex flex-col gap-2">
      {!open && hasDetails && (
        <div className="flex flex-col gap-3">
          <p className="inline-flex w-fit items-center gap-1.5 rounded-full bg-ink/10 px-2.5 py-0.5 text-xs font-medium text-ink/70">
            🔒 Only you can see this
          </p>
          {initialNotes && <p className="whitespace-pre-wrap font-hand text-[22px] leading-7 text-ink">{initialNotes}</p>}
          {photos.length > 0 && (
            <ul className="flex flex-wrap gap-4 pt-2">
              {photos.map((photo) => (
                <li key={photo.id}>
                  <JournalPhoto src={`/api/holdings/${holdingId}/photos/${photo.id}`} tilt={journalPhotoTilt(photo.id)} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {!open ? (
        editing && (
          <button type="button" onClick={() => setExpanded(true)} className="self-start text-sm font-medium text-brand underline hover:text-brand-hover">
            {hasDetails ? "Edit details" : "Add details"}
          </button>
        )
      ) : (
        <div className="flex flex-col gap-3">
          <p className="inline-flex w-fit items-center gap-1.5 rounded-full bg-ink/10 px-2.5 py-0.5 text-xs font-medium text-ink/70">
            🔒 Only you can see this
          </p>

          <form action={noteFormAction} className="flex flex-col gap-2">
            <textarea
              name="notes"
              rows={3}
              defaultValue={initialNotes}
              placeholder="What happened here? (optional)"
              className="rounded-md border border-ink/30 bg-white/70 px-2 py-1.5 font-hand text-xl leading-6 text-ink placeholder:text-ink/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            />
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={notePending}
                className="rounded-md bg-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-hover disabled:opacity-60"
              >
                {notePending ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                onClick={() => setExpanded(false)}
                disabled={notePending}
                className="rounded-md px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/10 disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
            {noteState.status === "error" && <p className="text-xs text-red-700">{noteState.message}</p>}
          </form>

          {photos.length > 0 && (
            <ul className="flex flex-wrap gap-4 pt-2">
              {photos.map((photo) => (
                <li key={photo.id}>
                  <JournalPhoto src={`/api/holdings/${holdingId}/photos/${photo.id}`} tilt={journalPhotoTilt(photo.id)}>
                  <form action={deletePhoto.bind(null, holdingId, photo.id)} className="absolute right-1 top-1">
                    <button
                      type="submit"
                      className="rounded-full bg-black/60 px-2 py-0.5 text-xs text-white hover:bg-black/80"
                    >
                      &times;
                    </button>
                  </form>
                  </JournalPhoto>
                </li>
              ))}
            </ul>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => openPicker("environment")}
              disabled={uploadPending}
              className="rounded-md border border-ink/30 bg-white/60 px-3 py-1.5 text-xs font-medium text-ink hover:bg-white disabled:opacity-60"
            >
              Take a photo
            </button>
            <button
              type="button"
              onClick={() => openPicker()}
              disabled={uploadPending}
              className="rounded-md border border-ink/30 bg-white/60 px-3 py-1.5 text-xs font-medium text-ink hover:bg-white disabled:opacity-60"
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

          {uploadPending && <p className="text-xs text-ink/60">Uploading…</p>}
          {pickError && <p className="text-xs text-red-700">{pickError}</p>}
          {uploadState.status === "error" && <p className="text-xs text-red-700">{uploadState.message}</p>}

          {imageSrc && (
            <PhotoCropModal imageSrc={imageSrc} onCancel={closeCropper} onConfirm={handleCropConfirm} pending={uploadPending} />
          )}
        </div>
      )}
    </div>
  );
}
