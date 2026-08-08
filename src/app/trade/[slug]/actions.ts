"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAppUser } from "@/lib/auth";

// Releasing has no recipient at all (brief section 6.4) — the current
// holder just confirms they no longer have it, moving it straight to their
// "ever had" list. Whoever finds the pin later scans its own sticker code
// and registers a fresh holding for themselves (registerPin in
// register/[slug]/actions.ts), independent of this action.
export async function releasePin(slug: string) {
  const user = await requireAppUser(`/trade/${slug}`);

  const pin = await prisma.pin.findUnique({
    where: { slug },
    include: { holdings: { where: { releasedAt: null, userId: user.id } } },
  });
  const openHolding = pin?.holdings[0];
  if (!pin || !openHolding) return;

  await prisma.pinHolding.update({
    where: { id: openHolding.id },
    data: { releasedAt: new Date() },
  });

  redirect(`/holdings/${openHolding.id}`);
}
