"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAppUser } from "@/lib/auth";

// Releasing has no recipient at all (brief section 6.4) — the current
// holder just confirms they no longer have it, moving it straight to their
// "ever had" list. Whoever finds the pin later scans its own sticker code
// and registers a fresh holding for themselves (registerPin in
// register/[slug]/actions.ts), independent of this action.
//
// If someone already tentatively claimed this pin while it was still held
// (a "pending" holding — see registerPin), releasing auto-promotes that
// claim to the real open holding in the same transaction, rather than
// leaving a gap where the pin briefly looks unclaimed.
export async function releasePin(slug: string) {
  const user = await requireAppUser(`/trade/${slug}`);

  const pin = await prisma.pin.findUnique({
    where: { slug },
    include: {
      holdings: { where: { releasedAt: null, OR: [{ userId: user.id, pending: false }, { pending: true }] } },
    },
  });
  const openHolding = pin?.holdings.find((h) => !h.pending && h.userId === user.id);
  if (!pin || !openHolding) return;
  const pendingHolding = pin.holdings.find((h) => h.pending);

  await prisma.$transaction(async (tx) => {
    await tx.pinHolding.update({
      where: { id: openHolding.id },
      data: { releasedAt: new Date() },
    });
    if (pendingHolding) {
      await tx.pinHolding.update({
        where: { id: pendingHolding.id },
        data: { pending: false },
      });
    }
  });

  redirect(`/holdings/${openHolding.id}`);
}
