"use client";

import { useState } from "react";

type VerifyFn = (lat: number, lng: number) => Promise<{ status: "ok" | "error"; message?: string }>;

// The "Verify location" link on an unverified journey entry, shown to that
// entry's owner only (verifying needs *their* device's current position, so
// there's nothing for anyone else to click). Verified entries get the star
// sticker instead (VerifiedStar), rendered by the page.
export function VerifyLocationButton({ onVerify }: { onVerify: VerifyFn }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        // On success, the page re-renders this entry with its star once this
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
        className="text-sm font-medium text-brand underline hover:text-brand-hover disabled:opacity-60"
      >
        {pending ? "Checking…" : "Verify location"}
      </button>
      {error && <span className="text-xs text-red-700">{error}</span>}
    </span>
  );
}
