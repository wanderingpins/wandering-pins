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

// Handles four cases:
//  1. Never-before-claimed (MINTED), or already-REGISTERED but released with
//     no recipient (brief section 6.4) — no open holding exists at all, so
//     this is an ordinary immediate claim, same as always.
//  2. A confirmed open holding exists, belongs to someone else, and no one
//     has a pending claim on it yet — creates a tentative/"unreleased"
//     holding instead of blocking outright (reverses the previous
//     behavior). It records everything normally; it just isn't the real
//     open holding yet, so it won't appear on the public page until the
//     current holder releases and it auto-promotes (see releasePin).
//  3. The confirmed open holding already belongs to *this* user — rejected,
//     nothing to claim.
//  4. A pending claim already exists (by anyone) — rejected; only one
//     pending claim per pin at a time.
// The unique-constraint catch (not a pre-check) is what actually guards
// against a race on any of these — the two partial unique indexes on
// pin_holdings (one for confirmed-open, one for pending) are the real
// guarantee, this is just a friendlier message ahead of that.
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
  if (!pin) {
    return { status: "error", message: "This pin can't be registered right now." };
  }

  const confirmedHolding = pin.holdings.find((h) => !h.pending);
  const pendingHolding = pin.holdings.find((h) => h.pending);
  if (confirmedHolding?.userId === user.id) {
    return { status: "error", message: "You already have this pin." };
  }
  if (pendingHolding) {
    return {
      status: "error",
      message: "Someone's already tentatively claimed this pin — check back once the current holder releases it.",
    };
  }

  const geocoded = await geocodePlace(parsed.data.place);
  if (!geocoded) {
    return { status: "error", message: "Couldn't find that place — try a city name." };
  }

  const isPending = !!confirmedHolding;
  let holdingId: string;
  try {
    holdingId = await prisma.$transaction(async (tx) => {
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
          pending: isPending,
        },
      });
      if (parsed.data.title) {
        await tx.pinTitle.create({ data: { holdingId: holding.id, title: parsed.data.title } });
      }
      if (parsed.data.notes) {
        await tx.holdingNote.create({ data: { holdingId: holding.id, body: parsed.data.notes } });
      }
      return holding.id;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return {
        status: "error",
        message: isPending
          ? "Someone just tentatively claimed this pin — you were a moment too late."
          : "Someone just registered this pin — you were a moment too late.",
      };
    }
    throw error;
  }

  // A pending claim doesn't show up on the public page yet, so send the
  // claimant to their own holding instead of somewhere that'd look like
  // nothing happened.
  redirect(isPending ? `/holdings/${holdingId}` : `/p/${slug}`);
}
