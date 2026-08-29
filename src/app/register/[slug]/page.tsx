import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { parseSlug } from "@/lib/slug";
import { requireAppUser } from "@/lib/auth";
import { RegisterForm } from "./RegisterForm";

const rawSlugSchema = z.string().min(1).max(64);

type Props = { params: Promise<{ slug: string }> };

export default async function RegisterPage({ params }: Props) {
  const { slug: rawParam } = await params;
  const user = await requireAppUser(`/register/${rawParam}`);

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
  if (!pin) {
    return (
      <main className="mx-auto max-w-md px-4 py-16">
        <h1 className="text-xl font-semibold">This pin hasn&apos;t been minted yet</h1>
        <p className="mt-2 text-neutral-700">
          Codes are created before they&apos;re printed on stickers — this one isn&apos;t in our
          system.
        </p>
      </main>
    );
  }

  // Covers both a never-before-claimed pin and one someone released with no
  // specific recipient (brief section 6.4) — either way, no open holding
  // means it's up for grabs, and the same form captures how/when/where.
  if (pin.holdings.length === 0) {
    return (
      <main className="mx-auto max-w-md px-4 py-16">
        <p className="text-sm text-neutral-500">Pin {pin.slug}</p>
        <h1 className="mt-1 text-xl font-semibold">Register this pin</h1>
        <div className="mt-6">
          <RegisterForm slug={pin.slug} />
        </div>
      </main>
    );
  }

  const confirmedHolding = pin.holdings.find((h) => !h.pending);
  const pendingHolding = pin.holdings.find((h) => h.pending);

  if (confirmedHolding?.userId === user.id) {
    return (
      <main className="mx-auto max-w-md px-4 py-16">
        <p className="text-sm text-neutral-500">Pin {pin.slug}</p>
        <h1 className="mt-1 text-xl font-semibold">You already have this pin</h1>
      </main>
    );
  }

  if (pendingHolding) {
    return (
      <main className="mx-auto max-w-md px-4 py-16">
        <p className="text-sm text-neutral-500">Pin {pin.slug}</p>
        <h1 className="mt-1 text-xl font-semibold">Someone already has a pending claim</h1>
        <p className="mt-2 text-neutral-700">
          Someone else has already tentatively claimed this pin. Check back once the current holder releases it.
        </p>
      </main>
    );
  }

  // Confirmed holding exists, belongs to someone else, and no one's
  // pending yet — registering now creates a tentative claim (product
  // decision): it's yours on My Pins right away, but it stays off this
  // pin's public journey until the current holder actually releases it.
  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <p className="text-sm text-neutral-500">Pin {pin.slug}</p>
      <h1 className="mt-1 text-xl font-semibold">Someone else currently has this pin</h1>
      <p className="mt-2 text-neutral-700">
        You can still add it to your account now. It&apos;ll show up as &quot;unreleased&quot; on your My Pins until
        the current holder releases it — only then does it join the public journey.
      </p>
      <div className="mt-6">
        <RegisterForm slug={pin.slug} />
      </div>
    </main>
  );
}
