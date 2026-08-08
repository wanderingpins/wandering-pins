import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { parseSlug } from "@/lib/slug";
import { requireAppUser } from "@/lib/auth";
import { RegisterForm } from "./RegisterForm";

const rawSlugSchema = z.string().min(1).max(64);

type Props = { params: Promise<{ slug: string }> };

export default async function RegisterPage({ params }: Props) {
  const { slug: rawParam } = await params;
  await requireAppUser(`/register/${rawParam}`);

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

  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <p className="text-sm text-neutral-500">Pin {pin.slug}</p>
      <h1 className="mt-1 text-xl font-semibold">This pin is already claimed</h1>
      <p className="mt-2 text-neutral-700">Someone else currently has this pin.</p>
    </main>
  );
}
