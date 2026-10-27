"use client";

import { useCallback, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";

type PhotoCropModalProps = {
  imageSrc: string;
  onCancel: () => void;
  onConfirm: (croppedAreaPixels: Area) => void;
  pending: boolean;
};

// Square crop, centered and zoomable — pins are round/small, so cropping
// down to a square keeps the pin itself and drops the surrounding desk/hand/
// background instead of shipping the whole original frame.
//
// Cancel and "Use this photo" live in a bar at the TOP, not the bottom: on a
// phone the browser's bottom toolbar / home indicator can sit over the last
// stretch of the screen, and a confirm button parked there can't be reached
// (a photo just taken with the camera showed no way to confirm it). `h-dvh`
// sizes the screen to the phone's actual visible height rather than its
// largest possible one, and the safe-area insets keep both bars clear of
// notches. Pinch-to-zoom works on the cropper itself; the slider is the
// fallback (and the mouse path on desktop).
export function PhotoCropModal({ imageSrc, onCancel, onConfirm, pending }: PhotoCropModalProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const handleCropComplete = useCallback((_area: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  return (
    <div className="fixed inset-x-0 top-0 z-50 flex h-dvh flex-col bg-black">
      <div className="flex items-center justify-between gap-3 bg-navy px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className="rounded-md bg-cream px-4 py-2.5 text-sm font-medium text-navy disabled:opacity-60"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => croppedAreaPixels && onConfirm(croppedAreaPixels)}
          disabled={!croppedAreaPixels || pending}
          className="rounded-md bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-hover disabled:opacity-60"
        >
          {pending ? "Uploading…" : "Use this photo"}
        </button>
      </div>

      <div className="relative min-h-0 flex-1">
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          aspect={1}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={handleCropComplete}
        />
      </div>

      <div className="flex flex-col gap-2 bg-navy px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <p className="text-center text-xs text-neutral-400">Drag to position, pinch or use the slider to zoom.</p>
        <label className="flex items-center gap-2 text-sm text-white">
          Zoom
          <input
            type="range"
            min={1}
            max={4}
            step={0.05}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="flex-1"
          />
        </label>
      </div>
    </div>
  );
}
