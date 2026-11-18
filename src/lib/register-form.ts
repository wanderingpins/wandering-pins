import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";

export type RegisterState = { status: "idle" | "error"; message?: string };

export const REGION_LOOKUP_FAILED =
  "Couldn't look up the state for that place just now — try again, or untick \"Only show the state\".";

// The new-pin form (components/PinRegistrationForm.tsx) — shared by claiming
// a pin via its sticker (s/[code]/claim) and by adding a pin with no sticker
// (pins/new), since both end in the same first PinHolding. The public face
// (name, description, front photo — the photo is handled by
// register-photo.ts), how/when/where, and the story.
export const MAX_TITLE_LENGTH = 80;
export const MAX_DESCRIPTION_LENGTH = 2000;
export const MAX_STORY_LENGTH = 5000;

const registerSchema = z.object({
  acquiredVia: z.enum(["BOUGHT", "TRADED", "GIFT", "FOUND", "OTHER"]),
  acquiredAt: z.string().min(1),
  place: z.string().min(1),
  title: z.string().trim().max(MAX_TITLE_LENGTH).optional(),
  description: z.string().trim().max(MAX_DESCRIPTION_LENGTH).optional(),
  notes: z.string().trim().max(MAX_STORY_LENGTH).optional(),
  // "Share my story on the pin's page" (HoldingNote.isPublic).
  storyPublic: z.boolean(),
  // Privacy choices (PinHolding.isPrivate / regionOnly) — unticked checkboxes
  // aren't sent at all, so absent means false.
  isPrivate: z.boolean(),
  regionOnly: z.boolean(),
});

export function parseRegisterForm(formData: FormData) {
  return registerSchema.safeParse({
    acquiredVia: formData.get("acquiredVia"),
    acquiredAt: formData.get("acquiredAt"),
    place: formData.get("place"),
    title: formData.get("title") || undefined,
    description: formData.get("description") || undefined,
    notes: formData.get("notes") || undefined,
    storyPublic: formData.get("storyPublic") === "on",
    isPrivate: formData.get("isPrivate") === "on",
    regionOnly: formData.get("regionOnly") === "on",
  });
}

export type RegisterFormData = z.infer<typeof registerSchema>;

// Creates the holding plus its optional title and note inside a caller's
// transaction, returning the new holding's id.
export async function createHoldingFromForm(
  tx: Prisma.TransactionClient,
  args: {
    pinId: string;
    userId: string;
    data: RegisterFormData;
    place: {
      placeLabel: string;
      lat: number;
      lng: number;
      regionOnly: boolean;
      regionLabel: string | null;
      regionLat: number | null;
      regionLng: number | null;
    };
    pending: boolean;
  }
): Promise<string> {
  const { pinId, userId, data, place, pending } = args;
  const holding = await tx.pinHolding.create({
    data: {
      pinId,
      userId,
      acquiredAt: new Date(data.acquiredAt),
      acquiredVia: data.acquiredVia,
      placeLabel: place.placeLabel,
      lat: place.lat,
      lng: place.lng,
      regionOnly: place.regionOnly,
      regionLabel: place.regionLabel,
      regionLat: place.regionLat,
      regionLng: place.regionLng,
      isPrivate: data.isPrivate,
      pending,
    },
  });
  if (data.title || data.description) {
    await tx.pinTitle.create({
      data: { holdingId: holding.id, title: data.title ?? "", description: data.description || null },
    });
  }
  if (data.notes) {
    await tx.holdingNote.create({ data: { holdingId: holding.id, body: data.notes, isPublic: data.storyPublic } });
  }
  return holding.id;
}
