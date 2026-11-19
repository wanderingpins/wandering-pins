"use client";

import { startTransition, useActionState, useRef, useState } from "react";
import type { Area } from "react-easy-crop";
import {
  copyPinPhotoToItem,
  removeSeriesBoxImage,
  removeSeriesItemImage,
  setSeriesBoxImage,
  setSeriesItemImage,
  type ActionState,
} from "@/app/series/actions";
import { PhotoCropModal } from "@/app/holdings/[holdingId]/PhotoCropModal";
import { cropPhotoToBlob } from "@/lib/crop-photo";
import { useEditMode } from "@/components/PinEditMode";

const MAX_SELECTION_BYTES = 25 * 1024 * 1024;

// The small "Use my pin's photo" / "Upload a picture" / "Remove photo" links
// under a series design. These set the SERIES picture, the one everybody sees
// (your own checklist already shows your linked pin's photo just for you).
// Same pick -> square crop -> upload flow as the pin photo, so a camera photo
// is shrunk on the phone before it's sent. With itemId null it manages the
// series' blind-box picture instead (Series.boxImagePath), same rules.
export function SeriesItemImageControl({
  seriesId,
  itemId,
  hasImage,
  canChange,
  pinPhoto,
  addLabel = "+ Upload a picture",
}: {
  seriesId: string;
  /** null: the series' picture of the unopened blind box. */
  itemId: string | null;
  hasImage: boolean;
  /** You added the current picture, or you're an admin. */
  canChange: boolean;
  /** Your pin linked to this design, when it has a photo: offers "Use my pin's photo". */
  pinPhoto?: { pinId: string };
  /** The link text when there's no picture yet. */
  addLabel?: string;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    itemId ? setSeriesItemImage.bind(null, seriesId, itemId) : setSeriesBoxImage.bind(null, seriesId),
    { status: "idle" }
  );
  // Copies the photo (a separate file), so later changes to your pin's photo
  // never touch the series picture.
  const [copyState, copyAction, copyPending] = useActionState<ActionState>(
    async () => (pinPhoto && itemId ? copyPinPhotoToItem(seriesId, itemId, pinPhoto.pinId) : { status: "idle" }),
    { status: "idle" }
  );
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [pickError, setPickError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Two explicit buttons, like the other photo pickers: newer Android phones
  // open a gallery-only picker for a plain image input, so the camera needs
  // its own button that sets `capture` before opening.
  function openPicker(capture?: "environment") {
    const input = inputRef.current;
    if (!input) return;
    if (capture) input.setAttribute("capture", capture);
    else input.removeAttribute("capture");
    input.click();
  }
  // On the series page, replacing or removing an existing picture waits for
  // "Edit series" (see PinEditMode), so a stray tap can't wipe one.
  const editing = useEditMode();

  if (hasImage && (!canChange || !editing)) return null;

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setPickError(null);
    if (!file.type.startsWith("image/")) return setPickError("Please choose an image file.");
    if (file.size > MAX_SELECTION_BYTES) return setPickError("That picture is too large.");
    setImageSrc(URL.createObjectURL(file));
  }

  function close() {
    if (imageSrc) URL.revokeObjectURL(imageSrc);
    setImageSrc(null);
  }

  async function handleConfirm(area: Area) {
    if (!imageSrc) return;
    let blob: Blob;
    try {
      blob = await cropPhotoToBlob(imageSrc, area);
    } catch {
      setPickError("Couldn't process that picture. Please try again.");
      close();
      return;
    }
    const fd = new FormData();
    fd.set("photo", new File([blob], "pin.jpg", { type: "image/jpeg" }));
    close();
    startTransition(() => formAction(fd));
  }

  const link = "text-xs text-accent hover:underline disabled:opacity-60";

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
      {pinPhoto && itemId && (
        <form action={copyAction}>
          <button type="submit" className={link} disabled={copyPending || pending}>
            {copyPending ? "Copying…" : "Use my pin's photo"}
          </button>
        </form>
      )}
      {pending ? (
        <span className="text-xs text-neutral-500">Uploading…</span>
      ) : (
        <>
          <button type="button" className={link} disabled={copyPending} onClick={() => openPicker("environment")}>
            📷 Take a photo
          </button>
          <button type="button" className={link} disabled={copyPending} onClick={() => openPicker()}>
            {hasImage ? "Upload a different picture" : addLabel}
          </button>
        </>
      )}
      {hasImage && (
        <form action={itemId ? removeSeriesItemImage.bind(null, seriesId, itemId) : removeSeriesBoxImage.bind(null, seriesId)}>
          <button type="submit" className="text-xs text-neutral-500 hover:text-red-600 hover:underline">
            Remove photo
          </button>
        </form>
      )}
      <p className="w-full text-center text-[11px] leading-snug text-neutral-500">
        Your photo will be seen by anyone looking at this series.
      </p>
      {(pickError || state.status === "error" || copyState.status === "error") && (
        <p className="w-full text-center text-xs text-red-600">
          {pickError ?? (state.status === "error" ? state.message : copyState.message)}
        </p>
      )}
      {imageSrc && <PhotoCropModal imageSrc={imageSrc} onCancel={close} onConfirm={handleConfirm} pending={pending} />}
    </div>
  );
}
