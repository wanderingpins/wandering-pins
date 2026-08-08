import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { parseSlug } from "@/lib/slug";
import { requireAppUser } from "@/lib/auth";
import { TradeForm } from "./TradeForm";
import { cancelTrade } from "./actions";
import { approveRelease } from "@/app/register/[slug]/actions";

const rawSlugSchema = z.string().min(1).max(64);

type Props = { params: Promise<{ slug: string }> };

export default async function TradePage({ params }: Props) {
  const { slug: rawParam } = await params;
  const user = await requireAppUser(`/trade/${rawParam}`);

  const rawSlugResult = rawSlugSchema.safeParse(rawParam);
  const parsed = rawSlugResult.success ? parseSlug(rawSlugResult.data) : { valid: false as const };
  if (!parsed.valid) {
    return (
      <main className="mx-auto max-w-md px-4 py-16">
        <h1 className="text-xl font-semibold">That code doesn&apos;t look right</h1>
      </main>
    );
  }

  const pin = await prisma.pin.findUnique({
    where: { slug: parsed.slug },
    include: { holdings: { where: { releasedAt: null, userId: user.id } } },
  });
  const openHolding = pin?.holdings[0];

  if (!pin || !openHolding) {
    return (
      <main className="mx-auto max-w-md px-4 py-16">
        <h1 className="text-xl font-semibold">You don&apos;t currently hold this pin</h1>
        <p className="mt-2 text-neutral-700">Only the current holder can log a trade for it.</p>
      </main>
    );
  }

  const existingPending = await prisma.trade.findFirst({
    where: { pinId: pin.id, fromUserId: user.id, status: "PENDING" },
    orderBy: { proposedAt: "desc" },
  });

  if (existingPending) {
    return (
      <main className="mx-auto max-w-md px-4 py-16">
        <p className="text-sm text-neutral-500">Pin {pin.slug}</p>
        <h1 className="mt-1 text-xl font-semibold">Trade pending</h1>
        {existingPending.claimedAt ? (
          <>
            <p className="mt-2 text-neutral-700">
              {existingPending.toEmail} already added this pin to their collection. Confirm below once
              it&apos;s physically left your hands.
            </p>
            <form action={approveRelease.bind(null, existingPending.id)} className="mt-6">
              <button
                type="submit"
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Confirm it&apos;s left your hands
              </button>
            </form>
          </>
        ) : (
          <>
            <p className="mt-2 text-neutral-700">Waiting for {existingPending.toEmail} to claim it.</p>
            <form action={cancelTrade.bind(null, existingPending.id)} className="mt-6">
              <button
                type="submit"
                className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
              >
                Cancel this trade
              </button>
            </form>
          </>
        )}
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <p className="text-sm text-neutral-500">Pin {pin.slug}</p>
      <h1 className="mt-1 text-xl font-semibold">Log a trade</h1>
      <p className="mt-2 text-sm text-neutral-600">
        They can claim it right away — you&apos;ll separately confirm once it&apos;s left your hands.
      </p>
      <div className="mt-6">
        <TradeForm slug={pin.slug} />
      </div>
    </main>
  );
}
