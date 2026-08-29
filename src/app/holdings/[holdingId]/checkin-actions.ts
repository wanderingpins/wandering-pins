"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAppUser } from "@/lib/auth";
import { getOwnedHolding } from "@/lib/holdings";
import { geocodePlace } from "@/lib/geocode";
import { processHoldingPhoto } from "@/lib/image";
import { uploadHoldingPhoto, deleteHoldingPhoto } from "@/lib/storage";
import { MAX_RAW_UPLOAD_BYTES, MAX_CHECKIN_PHOTOS } from "@/lib/photo-limits";

export type ActionState = { status: "idle" | "ok" | "error"; message?: string };

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

const checkInSchema = z.object({
  loggedAt: z.string().min(1),
  place: z.string().min(1),
});

// A check-in is public movement, so it can only be added against the real,
// confirmed current holding — a pending (tentative, not-yet-released)
// holding hasn't actually got the pin yet, and a released one is over.
export async function addCheckIn(holdingId: string, _prevState: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireAppUser(`/holdings/${holdingId}`);
  const holding = await getOwnedHolding(holdingId, user.id);
  if (!holding) {
    return { status: "error", message: "That's not your holding." };
  }
  if (holding.releasedAt !== null || holding.pending) {
    return { status: "error", message: "You can only log a new location while you're the confirmed current holder." };
  }

  const parsed = checkInSchema.safeParse({
    loggedAt: formData.get("loggedAt"),
    place: formData.get("place"),
  });
  if (!parsed.success) {
    return { status: "error", message: "Please fill in when and where." };
  }

  const geocoded = await geocodePlace(parsed.data.place);
  if (!geocoded) {
    return { status: "error", message: "Couldn't find that place — try a city name." };
  }

  await prisma.holdingCheckIn.create({
    data: {
      holdingId,
      loggedAt: new Date(parsed.data.loggedAt),
      placeLabel: geocoded.placeLabel,
      lat: geocoded.lat,
      lng: geocoded.lng,
    },
  });

  revalidatePath(`/holdings/${holdingId}`);
  return { status: "ok" };
}

async function getOwnedCheckIn(checkInId: string, userId: string) {
  const checkIn = await prisma.holdingCheckIn.findUnique({
    where: { id: checkInId },
    include: { holding: true },
  });
  if (!checkIn || checkIn.holding.userId !== userId) return null;
  return checkIn;
}

export async function updateCheckInNote(
  checkInId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireAppUser("/my-pins");
  const checkIn = await getOwnedCheckIn(checkInId, user.id);
  if (!checkIn) {
    return { status: "error", message: "That's not your check-in." };
  }

  const body = (formData.get("body") as string | null)?.trim() ?? "";
  if (body) {
    await prisma.holdingCheckInNote.upsert({
      where: { checkInId },
      update: { body },
      create: { checkInId, body },
    });
  } else {
    await prisma.holdingCheckInNote.deleteMany({ where: { checkInId } });
  }

  revalidatePath(`/holdings/${checkIn.holdingId}`);
  return { status: "ok" };
}

export async function uploadCheckInPhoto(
  checkInId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireAppUser("/my-pins");
  const checkIn = await getOwnedCheckIn(checkInId, user.id);
  if (!checkIn) {
    return { status: "error", message: "That's not your check-in." };
  }

  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) {
    return { status: "error", message: "Choose a photo first." };
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { status: "error", message: "Please upload a JPEG, PNG, or WebP image." };
  }
  if (file.size > MAX_RAW_UPLOAD_BYTES) {
    return { status: "error", message: "That image is too large (max 10MB)." };
  }

  const existingCount = await prisma.holdingCheckInPhoto.count({ where: { checkInId } });
  if (existingCount >= MAX_CHECKIN_PHOTOS) {
    return { status: "error", message: `You can add up to ${MAX_CHECKIN_PHOTOS} photos per location.` };
  }

  const rawBuffer = Buffer.from(await file.arrayBuffer());
  let processed: Buffer;
  try {
    processed = await processHoldingPhoto(rawBuffer);
  } catch {
    return { status: "error", message: "That file doesn't look like a valid image. Please try a different photo." };
  }
  const path = await uploadHoldingPhoto(checkInId, processed, "image/jpeg");

  await prisma.holdingCheckInPhoto.create({ data: { checkInId, url: path } });

  revalidatePath(`/holdings/${checkIn.holdingId}`);
  return { status: "ok" };
}

export async function deleteCheckInPhoto(checkInId: string, photoId: string) {
  const user = await requireAppUser("/my-pins");
  const checkIn = await getOwnedCheckIn(checkInId, user.id);
  if (!checkIn) return;

  const photo = await prisma.holdingCheckInPhoto.findUnique({ where: { id: photoId } });
  if (!photo || photo.checkInId !== checkInId) return;

  await deleteHoldingPhoto(photo.url);
  await prisma.holdingCheckInPhoto.delete({ where: { id: photoId } });
  revalidatePath(`/holdings/${checkIn.holdingId}`);
}

// Deletes the whole location entry — its note and photos (storage objects
// too) go with it. Never cascades to the parent holding itself.
export async function deleteCheckIn(checkInId: string) {
  const user = await requireAppUser("/my-pins");
  const checkIn = await getOwnedCheckIn(checkInId, user.id);
  if (!checkIn) return;

  const photos = await prisma.holdingCheckInPhoto.findMany({ where: { checkInId } });
  await Promise.all(photos.map((p) => deleteHoldingPhoto(p.url)));

  await prisma.$transaction([
    prisma.holdingCheckInPhoto.deleteMany({ where: { checkInId } }),
    prisma.holdingCheckInNote.deleteMany({ where: { checkInId } }),
    prisma.holdingCheckIn.delete({ where: { id: checkInId } }),
  ]);

  revalidatePath(`/holdings/${checkIn.holdingId}`);
}
