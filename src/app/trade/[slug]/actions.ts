"use server";

import { z } from "zod";
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

  const pin = await prisma.pin.findUnique({
    where: { slug },
    include: { holdings: { where: { releasedAt: null } } },
  });
  const openHolding = pin?.holdings[0];
  if (!pin || !openHolding || openHolding.userId !== user.id) {
    return { status: "error", message: "You don't currently hold this pin." };
  }

  if (parsed.data.toEmail === user.email) {
    return { status: "error", message: "You can't trade a pin to yourself." };
  }

  const geocoded = await geocodePlace(parsed.data.place);
  if (!geocoded) {
    return { status: "error", message: "Couldn't find that place — try a city name." };
  }

  // Look up an existing account by email so confirmTrade can match on
  // toUserId immediately — but the response is identical either way, so we
  // never reveal to the sender whether that address already has an account
  // (brief section 8).
  const existingRecipient = await prisma.user.findUnique({ where: { email: parsed.data.toEmail } });

  await prisma.trade.create({
    data: {
      pinId: pin.id,
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
