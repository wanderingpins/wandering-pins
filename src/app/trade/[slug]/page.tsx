import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { parseSlug } from "@/lib/slug";
import { requireAppUser } from "@/lib/auth";
import { TradeForm } from "./TradeForm";

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
    include: { holdings: { where: { releasedAt: null } } },
  });
  const openHolding = pin?.holdings[0];

  if (!pin || !openHolding || openHolding.userId !== user.id) {
    return (
      <main className="mx-auto max-w-md px-4 py-16">
        <h1 className="text-xl font-semibold">You don&apos;t currently hold this pin</h1>
        <p className="mt-2 text-neutral-700">Only the current holder can log a trade for it.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <p className="text-sm text-neutral-500">Pin {pin.slug}</p>
      <h1 className="mt-1 text-xl font-semibold">Log a trade</h1>
      <p className="mt-2 text-sm text-neutral-600">
        They&apos;ll need to confirm before it shows up as theirs.
      </p>
      <div className="mt-6">
        <TradeForm slug={pin.slug} />
      </div>
    </main>
  );
}
