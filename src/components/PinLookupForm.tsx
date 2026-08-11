"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { QrScanButton } from "@/components/QrScanButton";

export function PinLookupForm() {
  const router = useRouter();
  const [code, setCode] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) return;
    // Full validation (checksum, alphabet) happens on /p/[slug] itself —
    // this just routes there. Same page shows a helpful message if it
    // doesn't check out.
    router.push(`/p/${encodeURIComponent(trimmed)}`);
  }

  return (
    <div>
      <QrScanButton onScan={setCode} />
      <form onSubmit={handleSubmit} className="mt-2 flex gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Type the code, e.g. K7M2-QX9"
          className="flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm"
          aria-label="Pin code"
        />
        <button
          type="submit"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Find it
        </button>
      </form>
    </div>
  );
}
