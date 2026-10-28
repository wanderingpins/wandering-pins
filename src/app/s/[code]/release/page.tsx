import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { parseSlug } from "@/lib/slug";
import { requireAppUser } from "@/lib/auth";
import { releasePin } from "./actions";

const rawCodeSchema = z.string().min(1).max(64);

type Props = { params: Promise<{ code: string }> };

export default async function TradePage({ params }: Props) {
  const { code: rawParam } = await params;
  const user = await requireAppUser(`/s/${rawParam}/release`);

  const rawSlugResult = rawCodeSchema.safeParse(rawParam);
  const parsed = rawSlugResult.success ? parseSlug(rawSlugResult.data) : { valid: false as const };
  if (!parsed.valid) {
    return (
      <main className="mx-auto max-w-md px-4 py-16">
        <h1 className="text-xl font-semibold">That code doesn&apos;t look right</h1>
      </main>
    );
  }

  const sticker = await prisma.sticker.findUnique({
    where: { code: parsed.slug },
    // pending: false — a tentative claim isn't the real current holder yet
    // and can't release a pin it doesn't actually have.
    include: { pin: { include: { holdings: { where: { releasedAt: null, userId: user.id, pending: false } } } } },
  });
  const pin = sticker?.pin;
  const openHolding = pin?.holdings[0];

  if (!pin || !openHolding) {
    return (
      <main className="mx-auto max-w-md px-4 py-16">
        <h1 className="text-xl font-semibold">You don&apos;t currently hold this pin</h1>
        <p className="mt-2 text-neutral-700">Only the current holder can log a trade for it.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <p className="text-sm text-neutral-500">Pin #{pin.number}</p>
      <h1 className="mt-1 text-xl font-semibold">Log a trade</h1>
      <p className="mt-2 text-sm text-neutral-600">
        Marking this as traded moves it to your &quot;ever had&quot; list right away — you don&apos;t
        need to know who&apos;s getting it. If you want, you can add private details about the trade
        afterward.
      </p>
      <form action={releasePin.bind(null, parsed.slug)} className="mt-6">
        <button
          type="submit"
          className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover"
        >
          I traded this pin away
        </button>
      </form>
    </main>
  );
}
