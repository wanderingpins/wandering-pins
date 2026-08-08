"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAppUser } from "@/lib/auth";
import { geocodePlace } from "@/lib/geocode";
import { Prisma } from "@/generated/prisma/client";

export type RegisterState = { status: "idle" | "error"; message?: string };

const registerSchema = z.object({
  acquiredVia: z.enum(["BOUGHT", "TRADED", "GIFT", "FOUND", "OTHER"]),
  acquiredAt: z.string().min(1),
  place: z.string().min(1),
  title: z.string().optional(),
  notes: z.string().optional(),
});

// Handles both a never-before-claimed (MINTED) pin and an already-REGISTERED
// pin someone released with no specific recipient (brief section 6.4) —
// either way, "no open holding exists" is the real precondition. Only flips
// pin.status/registeredAt the first time; a re-registration leaves those
// alone. The unique-constraint catch (not a pre-check) is what actually
// guards against two people racing to register the same pin at once — the
// restored partial unique index on pin_holdings is the real guarantee.
export async function registerPin(
  slug: string,
  _prevState: RegisterState,
  formData: FormData
): Promise<RegisterState> {
  const user = await requireAppUser(`/register/${slug}`);

  const parsed = registerSchema.safeParse({
    acquiredVia: formData.get("acquiredVia"),
    acquiredAt: formData.get("acquiredAt"),
    place: formData.get("place"),
    title: formData.get("title") || undefined,
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) {
    return { status: "error", message: "Please fill in how, when, and where you got this pin." };
  }

  const pin = await prisma.pin.findUnique({
    where: { slug },
    include: { holdings: { where: { releasedAt: null } } },
  });
  if (!pin || pin.holdings.length > 0) {
    return { status: "error", message: "This pin can't be registered right now." };
  }

  const geocoded = await geocodePlace(parsed.data.place);
  if (!geocoded) {
    return { status: "error", message: "Couldn't find that place — try a city name." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      if (pin.status === "MINTED") {
        await tx.pin.update({
          where: { id: pin.id },
          data: { status: "REGISTERED", registeredAt: new Date() },
        });
      }
      const holding = await tx.pinHolding.create({
        data: {
          pinId: pin.id,
          userId: user.id,
          acquiredAt: new Date(parsed.data.acquiredAt),
          acquiredVia: parsed.data.acquiredVia,
          placeLabel: geocoded.placeLabel,
          lat: geocoded.lat,
          lng: geocoded.lng,
        },
      });
      if (parsed.data.title) {
        await tx.pinTitle.create({ data: { holdingId: holding.id, title: parsed.data.title } });
      }
      if (parsed.data.notes) {
        await tx.holdingNote.create({ data: { holdingId: holding.id, body: parsed.data.notes } });
      }
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { status: "error", message: "Someone just registered this pin — you were a moment too late." };
    }
    throw error;
  }

  redirect(`/p/${slug}`);
}
