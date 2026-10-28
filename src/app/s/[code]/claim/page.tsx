import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { parseSlug } from "@/lib/slug";
import { requireAppUser } from "@/lib/auth";
import { PinRegistrationForm } from "@/components/PinRegistrationForm";
import { attachStickerToPin, registerPin } from "./actions";

const rawCodeSchema = z.string().min(1).max(64);

type Props = { params: Promise<{ code: string }> };

export default async function ClaimPage({ params }: Props) {
  const { code: rawParam } = await params;
  const user = await requireAppUser(`/s/${rawParam}/claim`);

  const rawCodeResult = rawCodeSchema.safeParse(rawParam);
  const parsed = rawCodeResult.success ? parseSlug(rawCodeResult.data) : { valid: false as const };
  if (!parsed.valid) {
    return (
      <main className="mx-auto max-w-md px-4 py-16">
        <h1 className="text-xl font-semibold">That code doesn&apos;t look right</h1>
      </main>
    );
  }

  const sticker = await prisma.sticker.findUnique({
    where: { code: parsed.slug },
    include: { pin: { include: { holdings: { where: { releasedAt: null } } } } },
  });
  if (!sticker) {
    return (
      <main className="mx-auto max-w-md px-4 py-16">
        <h1 className="text-xl font-semibold">We don&apos;t have that sticker</h1>
        <p className="mt-2 text-neutral-700">
          Codes are created before they&apos;re printed on stickers — this one isn&apos;t in our system.
        </p>
      </main>
    );
  }

  const register = registerPin.bind(null, parsed.slug);
  const pin = sticker.pin;

  // A fresh sticker: it can start a new pin, or give a sticker-less pin the
  // user already holds its passport. The pin's number is its public identity,
  // so that's what labels each one here — never this sticker's code.
  if (!pin) {
    const stickerlessHoldings = await prisma.pinHolding.findMany({
      where: { userId: user.id, releasedAt: null, pending: false, pin: { sticker: null } },
      include: { pin: true, title: true },
      orderBy: { acquiredAt: "desc" },
    });

    return (
      <main className="mx-auto max-w-md px-4 py-16">
        <h1 className="text-xl font-semibold">Use this sticker</h1>

        {stickerlessHoldings.length > 0 && (
          <section className="mt-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
              Put it on a pin you already have
            </h2>
            <ul className="mt-3 flex flex-col gap-2">
              {stickerlessHoldings.map((h) => (
                <li key={h.id} className="flex items-center justify-between gap-3 rounded-md border border-neutral-200 p-3">
                  <span className="text-sm">
                    {h.title?.title.trim() || h.placeLabel}
                    <span className="text-neutral-500"> · Pin #{h.pin.number}</span>
                  </span>
                  <form action={attachStickerToPin.bind(null, parsed.slug, h.pinId)}>
                    <button
                      type="submit"
                      className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-hover"
                    >
                      Attach
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            {stickerlessHoldings.length > 0 ? "Or register a new pin with it" : "Register a new pin with it"}
          </h2>
          <div className="mt-3">
            <PinRegistrationForm action={register} />
          </div>
        </section>
      </main>
    );
  }

  const confirmedHolding = pin.holdings.find((h) => !h.pending);
  const pendingHolding = pin.holdings.find((h) => h.pending);

  // No open holding: never claimed, or someone released it with no specific
  // recipient (brief section 6.4) — either way it's up for grabs, and the
  // same form captures how/when/where.
  if (pin.holdings.length === 0) {
    return (
      <main className="mx-auto max-w-md px-4 py-16">
        <p className="text-sm text-neutral-500">Pin #{pin.number}</p>
        <h1 className="mt-1 text-xl font-semibold">Register this pin</h1>
        <div className="mt-6">
          <PinRegistrationForm action={register} />
        </div>
      </main>
    );
  }

  if (confirmedHolding?.userId === user.id) {
    return (
      <main className="mx-auto max-w-md px-4 py-16">
        <p className="text-sm text-neutral-500">Pin #{pin.number}</p>
        <h1 className="mt-1 text-xl font-semibold">You already have this pin</h1>
      </main>
    );
  }

  if (pendingHolding) {
    return (
      <main className="mx-auto max-w-md px-4 py-16">
        <p className="text-sm text-neutral-500">Pin #{pin.number}</p>
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
      <p className="text-sm text-neutral-500">Pin #{pin.number}</p>
      <h1 className="mt-1 text-xl font-semibold">Someone else currently has this pin</h1>
      <p className="mt-2 text-neutral-700">
        You can still add it to your account now. It&apos;ll show up as &quot;unreleased&quot; on your My Pins until
        the current holder releases it — only then does it join the public journey.
      </p>
      <div className="mt-6">
        <PinRegistrationForm action={register} />
      </div>
    </main>
  );
}
