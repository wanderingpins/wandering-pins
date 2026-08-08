"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAppUser } from "@/lib/auth";
import { geocodePlace } from "@/lib/geocode";

export type TradeState = { status: "idle" | "sent" | "error"; message?: string };

const tradeSchema = z.object({
  toEmail: z.string().email(),
  place: z.string().min(1),
});

export async function initiateTrade(
  slug: string,
  _prevState: TradeState,
  formData: FormData
): Promise<TradeState> {
  const user = await requireAppUser(`/trade/${slug}`);

  const parsed = tradeSchema.safeParse({
    toEmail: formData.get("toEmail"),
    place: formData.get("place"),
  });
  if (!parsed.success) {
    return { status: "error", message: "Enter a valid email and where the trade happened." };
  }

  // Scoped to this user's own open holding — a pin can have more than one
  // open holding at a time now (claim and release are independent), so an
  // unscoped [0] could belong to the other side of an in-flight trade.
  const pin = await prisma.pin.findUnique({
    where: { slug },
    include: { holdings: { where: { releasedAt: null, userId: user.id } } },
  });
  const openHolding = pin?.holdings[0];
  if (!pin || !openHolding) {
    return { status: "error", message: "You don't currently hold this pin." };
  }

  // Only one live outgoing offer per holding at a time — otherwise the same
  // open holding could be claimed by two different recipients. Cancel the
  // existing one first (cancelTrade) to offer it to someone else instead.
  const existingPending = await prisma.trade.findFirst({
    where: { pinId: pin.id, fromUserId: user.id, status: "PENDING" },
  });
  if (existingPending) {
    return {
      status: "error",
      message: existingPending.claimedAt
        ? "You already traded this pin away — confirm it's left your hands before offering it again."
        : "You already have a pending trade for this pin — cancel it first if you want to offer it to someone else.",
    };
  }

  if (parsed.data.toEmail === user.email) {
    return { status: "error", message: "You can't trade a pin to yourself." };
  }

  const geocoded = await geocodePlace(parsed.data.place);
  if (!geocoded) {
    return { status: "error", message: "Couldn't find that place — try a city name." };
  }

  // Look up an existing account by email so claimTrade can match on
  // toUserId immediately — but the response is identical either way, so we
  // never reveal to the sender whether that address already has an account
  // (brief section 8).
  const existingRecipient = await prisma.user.findUnique({ where: { email: parsed.data.toEmail } });

  await prisma.trade.create({
    data: {
      pinId: pin.id,
      holdingId: openHolding.id,
      fromUserId: user.id,
      toEmail: parsed.data.toEmail,
      toUserId: existingRecipient?.id,
      placeLabel: geocoded.placeLabel,
      lat: geocoded.lat,
      lng: geocoded.lng,
    },
  });

  return { status: "sent" };
}

// Voids an offer the recipient hasn't claimed yet, freeing the giver to
// offer the pin to someone else (the only escape hatch from initiateTrade's
// one-live-offer guard above). Nothing to cancel once claimed — the pin's
// legitimately gone from their control at that point, only approveRelease
// (register/[slug]/actions.ts) applies.
export async function cancelTrade(tradeId: string) {
  const user = await requireAppUser("/sign-in");
  const trade = await prisma.trade.findUnique({ where: { id: tradeId } });
  if (!trade || trade.fromUserId !== user.id || trade.status !== "PENDING" || trade.claimedAt) return;

  const pin = await prisma.pin.findUniqueOrThrow({ where: { id: trade.pinId } });

  await prisma.trade.update({
    where: { id: trade.id },
    data: { status: "DECLINED", resolvedAt: new Date() },
  });

  redirect(`/trade/${pin.slug}`);
}
