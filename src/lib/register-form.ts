import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";

export type RegisterState = { status: "idle" | "error"; message?: string };

// The "how, when, where did you get it" form — shared by claiming a pin via
// its sticker (s/[code]/claim) and by adding a pin with no sticker
// (pins/new), since both end in the same first PinHolding.
const registerSchema = z.object({
  acquiredVia: z.enum(["BOUGHT", "TRADED", "GIFT", "FOUND", "OTHER"]),
  acquiredAt: z.string().min(1),
  place: z.string().min(1),
  title: z.string().optional(),
  notes: z.string().optional(),
});

export function parseRegisterForm(formData: FormData) {
  return registerSchema.safeParse({
    acquiredVia: formData.get("acquiredVia"),
    acquiredAt: formData.get("acquiredAt"),
    place: formData.get("place"),
    title: formData.get("title") || undefined,
    notes: formData.get("notes") || undefined,
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
    place: { placeLabel: string; lat: number; lng: number };
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
      pending,
    },
  });
  if (data.title) {
    await tx.pinTitle.create({ data: { holdingId: holding.id, title: data.title } });
  }
  if (data.notes) {
    await tx.holdingNote.create({ data: { holdingId: holding.id, body: data.notes } });
  }
  return holding.id;
}
