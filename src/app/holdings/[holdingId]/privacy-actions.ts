"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAppUser } from "@/lib/auth";
import { getOwnedHolding } from "@/lib/holdings";
import { setPlaceRegionOnly } from "@/lib/place-privacy";

export type PrivacyState = { status: "idle" | "ok" | "error"; message?: string };

// The holder's own privacy switches (see PinHolding.isPrivate / regionOnly).
// Any stretch of yours can be switched, open or already released: your part
// of a pin's journey stays yours to hide.

async function refresh(holdingId: string, pinId: string) {
  const pin = await prisma.pin.findUnique({ where: { id: pinId }, select: { number: true } });
  if (pin) revalidatePath(`/p/${pin.number}`);
  revalidatePath(`/holdings/${holdingId}`);
  revalidatePath("/pins");
  revalidatePath("/my-pins");
}

export async function setHoldingPrivate(holdingId: string, makePrivate: boolean): Promise<PrivacyState> {
  const user = await requireAppUser(`/holdings/${holdingId}`);
  const holding = await getOwnedHolding(holdingId, user.id);
  if (!holding) return { status: "error", message: "That's not your pin." };

  await prisma.pinHolding.update({ where: { id: holdingId }, data: { isPrivate: makePrivate } });
  await refresh(holdingId, holding.pinId);
  return { status: "ok" };
}

const LOOKUP_FAILED = "Couldn't look up the state for that place just now — please try again.";

// Where you got it (the holding's own place).
export async function setHoldingRegionOnly(holdingId: string, regionOnly: boolean): Promise<PrivacyState> {
  const user = await requireAppUser(`/holdings/${holdingId}`);
  const holding = await getOwnedHolding(holdingId, user.id);
  if (!holding) return { status: "error", message: "That's not your pin." };

  if (!(await setPlaceRegionOnly("holding", holding, regionOnly))) return { status: "error", message: LOOKUP_FAILED };
  await refresh(holdingId, holding.pinId);
  return { status: "ok" };
}

// One of the places you logged while holding it.
export async function setCheckInRegionOnly(checkInId: string, regionOnly: boolean): Promise<PrivacyState> {
  const user = await requireAppUser("/my-pins");
  const checkIn = await prisma.holdingCheckIn.findUnique({ where: { id: checkInId }, include: { holding: true } });
  if (!checkIn || checkIn.holding.userId !== user.id) return { status: "error", message: "That's not your pin." };

  if (!(await setPlaceRegionOnly("checkin", checkIn, regionOnly))) return { status: "error", message: LOOKUP_FAILED };
  await refresh(checkIn.holdingId, checkIn.holding.pinId);
  return { status: "ok" };
}

// "Share my story on the pin's page" (HoldingNote.isPublic). Only a story
// with something in it can be shared.
export async function setStoryPublic(holdingId: string, share: boolean): Promise<PrivacyState> {
  const user = await requireAppUser(`/holdings/${holdingId}`);
  const holding = await getOwnedHolding(holdingId, user.id);
  if (!holding) return { status: "error", message: "That's not your pin." };

  const note = await prisma.holdingNote.findUnique({ where: { holdingId } });
  if (share && !note?.body.trim()) return { status: "error", message: "Write your story first, then share it." };
  if (note) await prisma.holdingNote.update({ where: { holdingId }, data: { isPublic: share } });
  await refresh(holdingId, holding.pinId);
  return { status: "ok" };
}
