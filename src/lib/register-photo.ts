import { prisma } from "@/lib/prisma";
import { processHoldingPhoto } from "@/lib/image";
import { uploadHoldingPhoto } from "@/lib/storage";
import { MAX_RAW_UPLOAD_BYTES } from "@/lib/photo-limits";

// The optional front photo on the new-pin form (PinRegistrationForm). Checked
// and processed BEFORE the pin is created, so a bad file is reported without
// leaving a half-made pin behind; stored afterwards, once there's a holding
// to attach it to. Same rules as uploadPhoto in holdings/[holdingId]/actions.

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export type PreparedPhoto = { ok: true; buffer: Buffer | null } | { ok: false; message: string };

export async function prepareRegisterPhoto(formData: FormData): Promise<PreparedPhoto> {
  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) return { ok: true, buffer: null };
  if (!ALLOWED_TYPES.includes(file.type)) return { ok: false, message: "Please use a JPEG, PNG, or WebP photo." };
  if (file.size > MAX_RAW_UPLOAD_BYTES) return { ok: false, message: "That photo is too large (max 10MB)." };
  try {
    return { ok: true, buffer: await processHoldingPhoto(Buffer.from(await file.arrayBuffer())) };
  } catch {
    return { ok: false, message: "That file doesn't look like a valid photo. Please try a different one." };
  }
}

// Stores it as the holding's FRONT photo. A storage failure here doesn't undo
// the new pin — it's logged, and the photo can be added again from the pin page.
export async function saveRegisterPhoto(holdingId: string, buffer: Buffer | null): Promise<void> {
  if (!buffer) return;
  try {
    const path = await uploadHoldingPhoto(holdingId, buffer, "image/jpeg");
    await prisma.holdingPhoto.create({ data: { holdingId, url: path, kind: "FRONT" } });
  } catch (error) {
    console.error("Saving the new pin's photo failed", error);
  }
}
