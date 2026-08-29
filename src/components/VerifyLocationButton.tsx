"use client";

import { useState } from "react";

type VerifyFn = (lat: number, lng: number) => Promise<{ status: "ok" | "error"; message?: string }>;

// Shown next to a journey line's place — public either way (anyone can see
// whether a location is verified), but only that line's owner gets a
// clickable button, since verifying requires *their* device's current
// position. TODO(product): swap the text label for a dedicated icon once
// one exists — plain text for now.
export function VerifyLocationButton({
  verified,
  isOwn,
  onVerify,
}: {
  verified: boolean;
  isOwn: boolean;
  onVerify: VerifyFn;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (verified) {
    return <span className="text-xs text-green-700">✅ Location verified</span>;
  }

  if (!isOwn) {
    return <span className="text-xs text-neutral-400">Not verified</span>;
  }

  function handleClick() {
    setPending(true);
    setError(null);

    if (!("geolocation" in navigator)) {
      setError("Location couldn't be verified — this browser doesn't support it.");
      setPending(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const result = await onVerify(position.coords.latitude, position.coords.longitude);
        if (result.status === "error") {
          setError(result.message ?? "Location couldn't be verified.");
        }
        // On success, the parent's `verified` prop flips to true once this
        // server action's revalidation lands — no local "verified" state
        // needed here.
        setPending(false);
      },
      () => {
        setError("Location couldn't be verified — check your browser's location permission and try again.");
        setPending(false);
      },
      { timeout: 10000, maximumAge: 0 }
    );
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="text-xs text-neutral-500 underline hover:text-neutral-700 disabled:opacity-60"
      >
        {pending ? "Checking…" : "Not verified"}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </span>
  );
}
