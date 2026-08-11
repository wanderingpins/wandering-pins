"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAppUser } from "@/lib/auth";
import { getOwnedHolding } from "@/lib/holdings";
import { processHoldingPhoto } from "@/lib/image";
import { uploadHoldingPhoto, deleteHoldingPhoto } from "@/lib/storage";
import { MAX_RAW_UPLOAD_BYTES } from "@/lib/photo-limits";

export type ActionState = { status: "idle" | "ok" | "error"; message?: string };

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
