"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAppUser } from "@/lib/auth";
import { getOwnedHolding } from "@/lib/holdings";
import { processHoldingPhoto } from "@/lib/image";
import { uploadHoldingPhoto, deleteHoldingPhoto } from "@/lib/storage";
import { MAX_RAW_UPLOAD_BYTES } from "@/lib/photo-limits";
import { haversineDistanceKm, VERIFY_TOLERANCE_KM } from "@/lib/geo-distance";

export type ActionState = { status: "idle" | "ok" | "error"; message?: string };
export type VerifyLocationResult = { status: "ok" | "error"; message?: string };

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export async function updateHoldingDetails(
  holdingId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireAppUser(`/holdings/${holdingId}`);
  const holding = await getOwnedHolding(holdingId, user.id);
  if (!holding) {
    return { status: "error", message: "That's not your holding." };
  }

  const title = (formData.get("title") as string | null)?.trim() ?? "";
  const notes = (formData.get("notes") as string | null)?.trim() ?? "";
  const releaseDateRaw = (formData.get("releaseDate") as string | null)?.trim() ?? "";
  const releasePlaceLabel = (formData.get("releasePlaceLabel") as string | null)?.trim() ?? "";

  if (title) {
    await prisma.pinTitle.upsert({ where: { holdingId }, update: { title }, create: { holdingId, title } });
  } else {
    await prisma.pinTitle.deleteMany({ where: { holdingId } });
  }

  // releaseDate/releasePlaceLabel are optional context for a pin released
  // with no specific recipient (brief section 6.4) — folded into the same
  // private note as the free-typed body, only ever visible to this holder.
  if (notes || releaseDateRaw || releasePlaceLabel) {
    const data = {
      body: notes,
      releaseDate: releaseDateRaw ? new Date(releaseDateRaw) : null,
      releasePlaceLabel: releasePlaceLabel || null,
    };
    await prisma.holdingNote.upsert({ where: { holdingId }, update: data, create: { holdingId, ...data } });
  } else {
    await prisma.holdingNote.deleteMany({ where: { holdingId } });
  }

  revalidatePath(`/holdings/${holdingId}`);
  return { status: "ok" };
}

// Narrower than updateHoldingDetails above — touches only the note's free-
// typed body, leaving title and any release date/place alone. Used by the
// inline "add details" widget on the public pin page (src/components/
// InlineHoldingDetails.tsx), which only ever shows a notes textarea, not
// the full holdings-page form — submitting it must not silently wipe a
// title or release info the holder set elsewhere.
export async function updateHoldingNote(holdingId: string, _prevState: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireAppUser(`/holdings/${holdingId}`);
  const holding = await getOwnedHolding(holdingId, user.id);
  if (!holding) {
    return { status: "error", message: "That's not your holding." };
  }

  const body = (formData.get("notes") as string | null)?.trim() ?? "";
  const existing = await prisma.holdingNote.findUnique({ where: { holdingId } });

  if (body) {
    await prisma.holdingNote.upsert({ where: { holdingId }, update: { body }, create: { holdingId, body } });
  } else if (existing?.releaseDate || existing?.releasePlaceLabel) {
    // Keep the row for its release date/place — just clear the free-typed
    // body rather than deleting the whole note.
    await prisma.holdingNote.update({ where: { holdingId }, data: { body: "" } });
  } else {
    await prisma.holdingNote.deleteMany({ where: { holdingId } });
  }

  revalidatePath(`/holdings/${holdingId}`);
  return { status: "ok" };
}

// Narrower than updateHoldingDetails above — touches only PinTitle's
// description, leaving the title itself alone. Used by the top-of-page
// public description widget on /p/[slug] (src/components/
// PinDescriptionWidget.tsx), which only ever shows a description textarea,
// not the full holdings-page form.
export async function updateDescription(holdingId: string, _prevState: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireAppUser(`/holdings/${holdingId}`);
  const holding = await getOwnedHolding(holdingId, user.id);
  if (!holding) {
    return { status: "error", message: "That's not your holding." };
  }

  const description = (formData.get("description") as string | null)?.trim() ?? "";
  const existing = await prisma.pinTitle.findUnique({ where: { holdingId } });

  if (description) {
    await prisma.pinTitle.upsert({
      where: { holdingId },
      update: { description },
      create: { holdingId, title: "", description },
    });
  } else if (existing?.title) {
    // Keep the row for its title — just clear the description.
    await prisma.pinTitle.update({ where: { holdingId }, data: { description: null } });
  } else {
    await prisma.pinTitle.deleteMany({ where: { holdingId } });
  }

  revalidatePath(`/holdings/${holdingId}`);
  return { status: "ok" };
}

const kindSchema = z.enum(["FRONT", "BACK", "OTHER"]);

export async function uploadPhoto(holdingId: string, _prevState: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireAppUser(`/holdings/${holdingId}`);
  const holding = await getOwnedHolding(holdingId, user.id);
  if (!holding) {
    return { status: "error", message: "That's not your holding." };
  }

  const kindParsed = kindSchema.safeParse(formData.get("kind"));
  const file = formData.get("photo");
  if (!kindParsed.success) {
    return { status: "error", message: "Pick front, back, or other." };
  }
  if (!(file instanceof File) || file.size === 0) {
    return { status: "error", message: "Choose a photo first." };
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { status: "error", message: "Please upload a JPEG, PNG, or WebP image." };
  }
  if (file.size > MAX_RAW_UPLOAD_BYTES) {
    return { status: "error", message: "That image is too large (max 10MB)." };
  }

  const rawBuffer = Buffer.from(await file.arrayBuffer());
  let processed: Buffer;
  try {
    processed = await processHoldingPhoto(rawBuffer);
  } catch {
    return { status: "error", message: "That file doesn't look like a valid image. Please try a different photo." };
  }
  const path = await uploadHoldingPhoto(holdingId, processed, "image/jpeg");

  await prisma.holdingPhoto.create({ data: { holdingId, url: path, kind: kindParsed.data } });

  revalidatePath(`/holdings/${holdingId}`);
  return { status: "ok" };
}

export async function deletePhoto(holdingId: string, photoId: string) {
  const user = await requireAppUser(`/holdings/${holdingId}`);
  const holding = await getOwnedHolding(holdingId, user.id);
  if (!holding) return;

  const photo = await prisma.holdingPhoto.findUnique({ where: { id: photoId } });
  if (!photo || photo.holdingId !== holdingId) return;

  await deleteHoldingPhoto(photo.url);
  await prisma.holdingPhoto.delete({ where: { id: photoId } });
  revalidatePath(`/holdings/${holdingId}`);
}

const coordsSchema = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) });

// Called directly from a client event handler (not a <form>), with the
// browser's own geolocation reading — not stored, per the deliberate
// decision not to keep raw device coordinates (see the schema comment on
// PinHolding.verified). Only the pass/fail boolean survives. An honesty
// nudge, not proof: not tamper-proof, and the tolerance is generous because
// city-level geocoding can legitimately be tens of km off (see geocode.ts).
export async function verifyHoldingLocation(
  holdingId: string,
  deviceLat: number,
  deviceLng: number
): Promise<VerifyLocationResult> {
  const user = await requireAppUser(`/holdings/${holdingId}`);
  const holding = await getOwnedHolding(holdingId, user.id);
  if (!holding) {
    return { status: "error", message: "That's not your holding." };
  }

  const parsed = coordsSchema.safeParse({ lat: deviceLat, lng: deviceLng });
  if (!parsed.success) {
    return { status: "error", message: "Location couldn't be verified." };
  }

  const distanceKm = haversineDistanceKm(parsed.data.lat, parsed.data.lng, holding.lat, holding.lng);
  if (distanceKm > VERIFY_TOLERANCE_KM) {
    return {
      status: "error",
      message: `That doesn't look like it's near ${holding.placeLabel} — leaving this unverified.`,
    };
  }

  await prisma.pinHolding.update({ where: { id: holdingId }, data: { verified: true } });
  revalidatePath(`/holdings/${holdingId}`);
  return { status: "ok" };
}
