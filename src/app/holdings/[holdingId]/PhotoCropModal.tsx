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
export function PhotoCropModal({ imageSrc, onCancel, onConfirm, pending }: PhotoCropModalProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const handleCropComplete = useCallback((_area: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="relative flex-1">
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
      <div className="flex flex-col gap-3 bg-neutral-900 p-4">
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
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="rounded-md bg-white px-4 py-2 text-sm font-medium text-neutral-900 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => croppedAreaPixels && onConfirm(croppedAreaPixels)}
            disabled={!croppedAreaPixels || pending}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {pending ? "Uploading…" : "Use this photo"}
          </button>
        </div>
      </div>
    </div>
  );
}
