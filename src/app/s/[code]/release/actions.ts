"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAppUser } from "@/lib/auth";

// Releasing has no recipient at all (brief section 6.4) — the current
// holder just confirms they no longer have it, moving it straight to their
// "ever had" list. Whoever finds the pin later scans its own sticker code
// and registers a fresh holding for themselves (registerPin in
// ../claim/actions.ts), independent of this action.
//
// Starting from the sticker's code is also what enforces "no sticker, no
// wandering": a sticker-less pin has no code to release it by.
//
// If someone already tentatively claimed this pin while it was still held
// (a "pending" holding — see registerPin), releasing auto-promotes that
// claim to the real open holding in the same transaction, rather than
// leaving a gap where the pin briefly looks unclaimed.
export async function releasePin(code: string) {
  const user = await requireAppUser(`/s/${code}/release`);

  const sticker = await prisma.sticker.findUnique({
    where: { code },
    include: {
      pin: {
        include: {
          holdings: { where: { releasedAt: null, OR: [{ userId: user.id, pending: false }, { pending: true }] } },
        },
      },
    },
  });
  const pin = sticker?.pin;
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
