import Link from "next/link";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { parseSlug } from "@/lib/slug";
import { resolveHolderDisplayName, buildTimeline } from "@/lib/timeline";
import { PinJourneyTimeline } from "@/components/PinJourneyTimeline";
import { PinJourneyMap } from "@/components/PinJourneyMap";

// Zod boundary for the raw route param — brief section 10 ("Zod at every
// input boundary, including the slug parser"). This just guards the shape;
// parseSlug (checksum, alphabet) is the real validation.
const rawSlugSchema = z.string().min(1).max(64);

type Props = { params: Promise<{ slug: string }> };

export default async function PinPage({ params }: Props) {
  const { slug: rawParam } = await params;
  const rawSlugResult = rawSlugSchema.safeParse(rawParam);
  if (!rawSlugResult.success) {
    return <BadCode reason="malformed" />;
  }

  const parsed = parseSlug(rawSlugResult.data);
  if (!parsed.valid) {
    return <BadCode reason={parsed.reason} />;
  }

  const pin = await prisma.pin.findUnique({
    where: { slug: parsed.slug },
    include: {
      holdings: {
        orderBy: { acquiredAt: "asc" },
        include: { user: true },
      },
    },
  });

  // A well-formed, checksum-valid slug with no DB row is functionally the
  // same as MINTED from a visitor's perspective (stickers are printed
  // before pins are claimed — brief section 2/5) — never a 404, never a
  // stranger's pin.
  if (!pin || pin.status === "MINTED") {
    return <UnregisteredPin slug={parsed.slug} />;
  }

  const holdings = pin.holdings.map((h) => ({
    acquiredAt: h.acquiredAt,
    acquiredVia: h.acquiredVia,
    placeLabel: h.placeLabel,
    holderDisplayName: resolveHolderDisplayName(h.user),
    lat: h.lat,
    lng: h.lng,
    isOpen: h.releasedAt === null,
  }));
  const lines = buildTimeline(holdings);
  const points = holdings.map((h) => ({ lat: h.lat, lng: h.lng, label: h.placeLabel }));

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <p className="text-sm text-neutral-500">Pin {parsed.slug}</p>
      <h1 className="mt-1 text-2xl font-semibold">Its journey so far</h1>

      <div className="mt-6">
        <PinJourneyMap points={points} />
      </div>

      <div className="mt-8">
        <PinJourneyTimeline lines={lines} />
      </div>

      <div className="mt-10 rounded-lg border border-neutral-200 p-4">
        <p className="text-sm text-neutral-700">Think you have this pin now?</p>
        <Link
          href={`/register/${parsed.slug}`}
          className="mt-2 inline-block rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Claim this pin
        </Link>
      </div>
    </main>
  );
}

function UnregisteredPin({ slug }: { slug: string }) {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <p className="text-sm text-neutral-500">Pin {slug}</p>
      <h1 className="mt-1 text-2xl font-semibold">This pin hasn&apos;t been registered yet.</h1>
      <p className="mt-3 text-neutral-700">
        Every Wandering Pins code is printed before anyone has claimed it. If this one is yours,
        register it now to start its journey.
      </p>
      <Link
        href={`/register/${slug}`}
        className="mt-6 inline-block rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        Register this pin
      </Link>
    </main>
  );
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
