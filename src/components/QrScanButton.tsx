"use client";

import jsQR from "jsqr";
import { useEffect, useRef, useState } from "react";
import { extractCodeFromScan } from "@/lib/scan-code";

type QrScanButtonProps = {
  onScan: (code: string) => void;
};

function getCameraErrorMessage(error: unknown): string {
  if (error instanceof DOMException && error.name === "NotAllowedError") {
    return "Camera access was denied. You can still type the code below.";
  }
  if (error instanceof DOMException && error.name === "NotFoundError") {
    return "No camera found on this device. You can still type the code below.";
  }
  return "Couldn't access the camera. You can still type the code below.";
}

export function QrScanButton({ onScan }: QrScanButtonProps) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    let stream: MediaStream | null = null;
    let rafId: number | null = null;
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { willReadFrequently: true });

    function scan() {
      const video = videoRef.current;
      if (!video || !context || cancelled) return;
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        const result = jsQR(imageData.data, imageData.width, imageData.height);
        if (result?.data) {
          onScan(extractCodeFromScan(result.data));
          setOpen(false);
          return;
        }
      }
      rafId = requestAnimationFrame(scan);
    }

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      } catch (err) {
        if (!cancelled) {
          setError(getCameraErrorMessage(err));
          setOpen(false);
        }
        return;
      }
      if (cancelled) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play();
      scan();
    }

    start();

    return () => {
      cancelled = true;
      if (rafId !== null) cancelAnimationFrame(rafId);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [open, onScan]);

  function handleClick() {
    setError(null);
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError("Camera scanning isn't supported on this browser. You can still type the code below.");
      return;
    }
    setOpen(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
      >
        Scan QR
      </button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {open && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-black/80 p-4">
          <video ref={videoRef} className="max-h-[70vh] w-full max-w-sm rounded-md" muted playsInline />
          <p className="text-sm text-white">Point your camera at the QR code on the back of the pin.</p>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-md bg-white px-4 py-2 text-sm font-medium text-neutral-900"
          >
            Cancel
          </button>
        </div>
      )}
    </>
  );
}
