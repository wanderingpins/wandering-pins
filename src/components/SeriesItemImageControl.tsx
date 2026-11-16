"use client";

import { useActionState, useRef, useState } from "react";
import type { Area } from "react-easy-crop";
import { removeSeriesItemImage, setSeriesItemImage, type ActionState } from "@/app/series/actions";
import { PhotoCropModal } from "@/app/holdings/[holdingId]/PhotoCropModal";
import { cropPhotoToBlob } from "@/lib/crop-photo";

const MAX_SELECTION_BYTES = 25 * 1024 * 1024;

// The small "Add picture" / "Replace" / "Remove" links under a series tile.
// Same pick -> square crop -> upload flow as the pin photo, so a camera photo
// is shrunk on the phone before it's sent.
export function SeriesItemImageControl({
  seriesId,
  itemId,
  hasImage,
  canChange,
}: {
  seriesId: string;
  itemId: string;
  hasImage: boolean;
  /** You added the current picture, or you're an admin. */
  canChange: boolean;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    setSeriesItemImage.bind(null, seriesId, itemId),
    { status: "idle" }
  );
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [pickError, setPickError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  if (hasImage && !canChange) return null;

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
    formAction(fd);
  }

  const link = "text-xs text-accent hover:underline disabled:opacity-60";

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3">
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
      <button type="button" className={link} disabled={pending} onClick={() => inputRef.current?.click()}>
        {pending ? "Uploading…" : hasImage ? "Replace picture" : "+ Add picture"}
      </button>
      {hasImage && (
        <form action={removeSeriesItemImage.bind(null, seriesId, itemId)}>
          <button type="submit" className="text-xs text-neutral-500 hover:text-red-600 hover:underline">
            Remove
          </button>
        </form>
      )}
      {(pickError || state.status === "error") && (
        <p className="w-full text-center text-xs text-red-600">{pickError ?? state.message}</p>
      )}
      {imageSrc && <PhotoCropModal imageSrc={imageSrc} onCancel={close} onConfirm={handleConfirm} pending={pending} />}
    </div>
  );
}
