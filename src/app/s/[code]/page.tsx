import Link from "next/link";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { parseSlug } from "@/lib/slug";
import { PinView } from "@/components/PinView";

// Zod boundary for the raw route param — brief section 10 ("Zod at every
// input boundary, including the slug parser"). This just guards the shape;
// parseSlug (checksum, alphabet) is the real validation.
const rawCodeSchema = z.string().min(1).max(64);

type Props = { params: Promise<{ code: string }> };

// Where a scanned (or typed) sticker lands. Having the code is what proves
// you're holding the physical pin, so this is the only page that offers to
// claim it — the public /p/{number} page never does. A sticker that isn't
// attached to a pin yet gets a short "use this sticker" landing instead.
export default async function ScanPage({ params }: Props) {
  const { code: rawParam } = await params;
  const rawCodeResult = rawCodeSchema.safeParse(rawParam);
  if (!rawCodeResult.success) {
    return <BadCode reason="malformed" />;
  }

  const parsed = parseSlug(rawCodeResult.data);
  if (!parsed.valid) {
    return <BadCode reason={parsed.reason} />;
  }

  const sticker = await prisma.sticker.findUnique({
    where: { code: parsed.slug },
    include: { pin: { select: { number: true } } },
  });
  if (!sticker) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10">
        <h1 className="text-2xl font-semibold">We don&apos;t have that sticker</h1>
        <p className="mt-3 text-neutral-700">
          That code isn&apos;t in our system. Double check it, or try scanning again.
        </p>
      </main>
    );
  }

  if (!sticker.pin) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10">
        <h1 className="text-2xl font-semibold">This sticker isn&apos;t on a pin yet.</h1>
        <p className="mt-3 text-neutral-700">
          Every Wandering Pins sticker is printed before anyone has used it. If this one is yours, use it to register a
          new pin, or attach it to one you already have, and start its journey.
        </p>
        <Link
          href={`/s/${parsed.slug}/claim`}
          className="mt-6 inline-block rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover"
        >
          Use this sticker
        </Link>
      </main>
    );
  }

  return <PinView pinNumber={sticker.pin.number} scanCode={parsed.slug} />;
}

function BadCode({ reason }: { reason: "malformed" | "bad_check_char" }) {
  const message =
    reason === "bad_check_char"
      ? "That code doesn't look right — double check for typos."
      : "That doesn't look like a Wandering Pins code.";
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-semibold">Hmm, that code doesn&apos;t look right</h1>
      <p className="mt-3 text-neutral-700">{message}</p>
    </main>
  );
}
