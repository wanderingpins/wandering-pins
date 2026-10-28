"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAppUser } from "@/lib/auth";
import { geocodePlace } from "@/lib/geocode";
import { createHoldingFromForm, parseRegisterForm, type RegisterState } from "@/lib/register-form";
import { Prisma } from "@/generated/prisma/client";

// Handles every way a scanned sticker can become part of someone's account.
// The sticker's code is what proves they're holding the physical pin, so
// every path here starts from it.
//
// A sticker that isn't on a pin yet (a freshly minted one) creates a new pin
// carrying it — case 0 below. Otherwise the pin already exists and:
//  1. No open holding at all (never claimed, or released with no recipient —
//     brief section 6.4) — an ordinary immediate claim.
//  2. A confirmed open holding exists, belongs to someone else, and no one
//     has a pending claim on it yet — creates a tentative/"unreleased"
//     holding instead of blocking outright. It records everything normally;
//     it just isn't the real open holding yet, so it won't appear on the
//     public page until the current holder releases and it auto-promotes
//     (see releasePin).
//  3. The confirmed open holding already belongs to *this* user — rejected,
//     nothing to claim.
//  4. A pending claim already exists (by anyone) — rejected; only one
//     pending claim per pin at a time.
// The unique-constraint catch (not a pre-check) is what actually guards
// against a race on any of these — the two partial unique indexes on
// pin_holdings (one for confirmed-open, one for pending) and the unique
// sticker.pin_id are the real guarantees, this is just a friendlier message
// ahead of that.
export async function registerPin(
  code: string,
  _prevState: RegisterState,
  formData: FormData
): Promise<RegisterState> {
  const user = await requireAppUser(`/s/${code}/claim`);

  const parsed = parseRegisterForm(formData);
  if (!parsed.success) {
    return { status: "error", message: "Please fill in how, when, and where you got this pin." };
  }

  const sticker = await prisma.sticker.findUnique({
    where: { code },
    include: { pin: { include: { holdings: { where: { releasedAt: null } } } } },
  });
  if (!sticker) {
    return { status: "error", message: "This pin can't be registered right now." };
  }

  const pin = sticker.pin;
  const confirmedHolding = pin?.holdings.find((h) => !h.pending);
  const pendingHolding = pin?.holdings.find((h) => h.pending);
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
  let result: { holdingId: string; pinNumber: number };
  try {
    result = await prisma.$transaction(async (tx) => {
      let target = pin ? { id: pin.id, number: pin.number } : null;
      if (!target) {
        // Claim the sticker first: the unique pin_id plus this conditional
        // update means only one concurrent registration can attach it.
        const created = await tx.pin.create({ data: {}, select: { id: true, number: true } });
        const attached = await tx.sticker.updateMany({
          where: { id: sticker.id, pinId: null },
          data: { pinId: created.id, attachedAt: new Date() },
        });
        if (attached.count === 0) throw new StickerTakenError();
        target = created;
      }
      const holdingId = await createHoldingFromForm(tx, {
        pinId: target.id,
        userId: user.id,
        data: parsed.data,
        place: geocoded,
        pending: isPending,
      });
      return { holdingId, pinNumber: target.number };
    });
  } catch (error) {
    if (error instanceof StickerTakenError) {
      return { status: "error", message: "Someone just used this sticker — you were a moment too late." };
    }
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
  redirect(isPending ? `/holdings/${result.holdingId}` : `/p/${result.pinNumber}`);
}

class StickerTakenError extends Error {}

// Attaches a fresh sticker to a sticker-less pin the user currently holds —
// the "I bought the pin first and the sticker later" path. Only the confirmed
// current holder can do this, since attaching is what lets the pin wander.
export async function attachStickerToPin(code: string, pinId: string) {
  const user = await requireAppUser(`/s/${code}/claim`);

  const [sticker, pin] = await Promise.all([
    prisma.sticker.findUnique({ where: { code } }),
    prisma.pin.findUnique({
      where: { id: pinId },
      include: { sticker: true, holdings: { where: { releasedAt: null, pending: false, userId: user.id } } },
    }),
  ]);
  if (!sticker || sticker.pinId || !pin || pin.sticker || pin.holdings.length === 0) {
    // Not a state the UI offers; a stale form or a hand-built request.
    return;
  }

  try {
    const attached = await prisma.sticker.updateMany({
      where: { id: sticker.id, pinId: null },
      data: { pinId: pin.id, attachedAt: new Date() },
    });
    if (attached.count === 0) return;
  } catch (error) {
    // The pin got another sticker in the meantime (unique pin_id).
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return;
    throw error;
  }

  redirect(`/p/${pin.number}`);
}
