"use client";

import { useEditMode } from "@/components/PinEditMode";
import { PinDescriptionWidget } from "@/components/PinDescriptionWidget";
import { TornPaper } from "@/components/TornPaper";

// The current holder's description note. Like a visitor's view, it only exists
// when there's a description — except in edit mode, when the blank note appears
// so a description can be written.
export function PinNote({
  holdingId,
  initialDescription,
  pinColor,
}: {
  holdingId: string;
  initialDescription: string;
  pinColor?: string;
}) {
  const editing = useEditMode();
  if (!editing && !initialDescription) return null;

  return (
    <TornPaper pinColor={pinColor}>
      <PinDescriptionWidget holdingId={holdingId} initialDescription={initialDescription} />
    </TornPaper>
  );
}
