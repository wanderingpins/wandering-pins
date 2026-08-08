"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAppUser } from "@/lib/auth";
import { geocodePlace } from "@/lib/geocode";

export type RegisterState = { status: "idle" | "error"; message?: string };

const registerSchema = z.object({
  acquiredVia: z.enum(["BOUGHT", "TRADED", "GIFT", "FOUND", "OTHER"]),
  acquiredAt: z.string().min(1),
  place: z.string().min(1),
  title: z.string().optional(),
  notes: z.string().optional(),
});

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

  const pin = await prisma.pin.findUnique({ where: { slug } });
  if (!pin || pin.status !== "MINTED") {
    return { status: "error", message: "This pin can't be registered right now." };
  }

  const geocoded = await geocodePlace(parsed.data.place);
  if (!geocoded) {
    return { status: "error", message: "Couldn't find that place — try a city name." };
  }

  await prisma.$transaction(async (tx) => {
    await tx.pin.update({
      where: { id: pin.id },
      data: { status: "REGISTERED", registeredAt: new Date() },
    });
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

  redirect(`/p/${slug}`);
}

// Claiming and declining are only meaningful before the receiver has
// claimed — once claimedAt is set there's nothing left to accept or refuse.
async function findClaimableTrade(tradeId: string) {
  const user = await requireAppUser("/sign-in");
  const trade = await prisma.trade.findUnique({ where: { id: tradeId } });
  if (!trade || trade.status === "DECLINED" || trade.claimedAt) return null;

  const isRecipient = trade.toUserId === user.id || (!!trade.toEmail && trade.toEmail === user.email);
  return isRecipient ? { trade, user } : null;
}

// Approving release is only meaningful for the giver, before they've already
// approved it once.
async function findApprovableTrade(tradeId: string) {
  const user = await requireAppUser("/sign-in");
  const trade = await prisma.trade.findUnique({ where: { id: tradeId } });
  if (!trade || trade.status === "DECLINED" || trade.giverReleasedAt) return null;

  return trade.fromUserId === user.id ? { trade, user } : null;
}

// Claiming needs no form data — the holding's public fields come from what
// the sender logged, not fresh input from the recipient (brief section 6.4).
// Claiming and releasing are independent, one-sided actions (brief section
// 6.4) — this only opens the recipient's holding. It never touches the
// giver's; approveRelease does that separately, in either order. The
// status/resolvedAt promotion to CONFIRMED has to be a single atomic UPDATE
// (not read-then-write) so a concurrent approveRelease can't race it into a
// permanently-stuck PENDING trade where both timestamps end up set but
// nothing ever notices.
export async function claimTrade(tradeId: string) {
  const match = await findClaimableTrade(tradeId);
  if (!match) return;
  const { trade, user } = match;

  const pin = await prisma.pin.findUniqueOrThrow({ where: { id: trade.pinId } });

  await prisma.$transaction(async (tx) => {
    await tx.pinHolding.create({
      data: {
        pinId: trade.pinId,
        userId: user.id,
        acquiredAt: new Date(),
        acquiredVia: "TRADED",
        placeLabel: trade.placeLabel ?? "Unknown",
        lat: trade.lat ?? 0,
        lng: trade.lng ?? 0,
      },
    });
    // Backfills toUserId when this was an email invite to someone who just
    // signed up — links the invite to the now-authenticated account.
    await tx.$executeRaw`
      UPDATE trades
      SET claimed_at = now(),
          to_user_id = ${user.id},
          status = CASE WHEN giver_released_at IS NOT NULL THEN 'CONFIRMED'::"TradeStatus" ELSE status END,
          resolved_at = CASE WHEN giver_released_at IS NOT NULL THEN now() ELSE resolved_at END
      WHERE id = ${trade.id}
    `;
  });

  redirect(`/p/${pin.slug}`);
}

// The giver's side of the same independent pair — closes their holding
// without requiring the receiver to have claimed yet, or vice versa. Scoped
// to trade.holdingId (the specific holding recorded at proposal time) so a
// stale/replayed action can't release a *different*, later holding of the
// same pin if this giver has since re-acquired it through another trade;
// falls back to the old {pinId, userId} match only for trades proposed
// before holdingId existed.
export async function approveRelease(tradeId: string) {
  const match = await findApprovableTrade(tradeId);
  if (!match) return;
  const { trade } = match;

  const pin = await prisma.pin.findUniqueOrThrow({ where: { id: trade.pinId } });

  await prisma.$transaction(async (tx) => {
    if (trade.holdingId) {
      await tx.pinHolding.updateMany({
        where: { id: trade.holdingId, releasedAt: null },
        data: { releasedAt: new Date() },
      });
    } else {
      await tx.pinHolding.updateMany({
        where: { pinId: trade.pinId, userId: trade.fromUserId, releasedAt: null },
        data: { releasedAt: new Date() },
      });
    }
    await tx.$executeRaw`
      UPDATE trades
      SET giver_released_at = now(),
          status = CASE WHEN claimed_at IS NOT NULL THEN 'CONFIRMED'::"TradeStatus" ELSE status END,
          resolved_at = CASE WHEN claimed_at IS NOT NULL THEN now() ELSE resolved_at END
      WHERE id = ${trade.id}
    `;
  });

  redirect(`/p/${pin.slug}`);
}

export async function declineTrade(tradeId: string) {
  const match = await findClaimableTrade(tradeId);
  if (!match) return;

  await prisma.trade.update({
    where: { id: match.trade.id },
    data: { status: "DECLINED", resolvedAt: new Date() },
  });
  redirect("/");
}
