import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { parseSlug } from "@/lib/slug";
import { requireAppUser } from "@/lib/auth";
import { RegisterForm } from "./RegisterForm";
import { confirmTrade, declineTrade } from "./actions";

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

  const pin = await prisma.pin.findUnique({ where: { slug: parsed.slug } });
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

  if (pin.status === "MINTED") {
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

  const pendingTrade = await prisma.trade.findFirst({
    where: {
      pinId: pin.id,
      status: "PENDING",
      OR: [{ toUserId: user.id }, { toEmail: user.email }],
    },
  });

  if (pendingTrade) {
    return (
      <main className="mx-auto max-w-md px-4 py-16">
        <p className="text-sm text-neutral-500">Pin {pin.slug}</p>
        <h1 className="mt-1 text-xl font-semibold">Someone traded you this pin</h1>
        <p className="mt-2 text-neutral-700">
          Confirming adds it to your collection and closes their turn with it.
        </p>
        <div className="mt-6 flex gap-3">
          <form action={confirmTrade.bind(null, pendingTrade.id)}>
            <button
              type="submit"
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Confirm
            </button>
          </form>
          <form action={declineTrade.bind(null, pendingTrade.id)}>
            <button
              type="submit"
              className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
            >
              Decline
            </button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <p className="text-sm text-neutral-500">Pin {pin.slug}</p>
      <h1 className="mt-1 text-xl font-semibold">This pin is already claimed</h1>
      <p className="mt-2 text-neutral-700">
        If it was traded to you, ask the sender to log the trade to your account.
      </p>
    </main>
  );
}
