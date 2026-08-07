import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAppUser } from "@/lib/auth";
import { formatMonthYear } from "@/lib/timeline";
import { PinLookupForm } from "@/components/PinLookupForm";

export default async function MyPinsPage() {
  const user = await requireAppUser("/my-pins");

  const holdings = await prisma.pinHolding.findMany({
    where: { userId: user.id },
    include: { pin: true },
    orderBy: { acquiredAt: "desc" },
  });

  const currentlyHave = holdings.filter((h) => h.releasedAt === null);
  const everHad = holdings;

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-semibold">My pins</h1>

      <section className="mt-6 rounded-lg border border-neutral-200 p-4">
        <h2 className="text-sm font-semibold text-neutral-700">Got a new pin?</h2>
        <p className="mt-1 text-sm text-neutral-600">
          Scan the code on the back, or type it below, to register it to your account.
        </p>
        <div className="mt-3 max-w-sm">
          <PinLookupForm />
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Currently have
        </h2>
        {currentlyHave.length === 0 ? (
          <p className="mt-3 text-neutral-600">Nothing right now.</p>
        ) : (
          <ul className="mt-3 divide-y divide-neutral-200">
            {currentlyHave.map((h) => (
              <HoldingRow key={h.id} id={h.id} slug={h.pin.slug} placeLabel={h.placeLabel} acquiredAt={h.acquiredAt} />
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Ever had
        </h2>
        {everHad.length === 0 ? (
          <p className="mt-3 text-neutral-600">No pins yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-neutral-200">
            {everHad.map((h) => (
              <HoldingRow
                key={h.id}
                id={h.id}
                slug={h.pin.slug}
                placeLabel={h.placeLabel}
                acquiredAt={h.acquiredAt}
                released={h.releasedAt !== null}
              />
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function HoldingRow({
  id,
  slug,
  placeLabel,
  acquiredAt,
  released,
}: {
  id: string;
  slug: string;
  placeLabel: string;
  acquiredAt: Date;
  released?: boolean;
}) {
  return (
    <li className="flex items-center justify-between py-3">
      <Link href={`/p/${slug}`} className="hover:underline">
        {placeLabel} · {formatMonthYear(acquiredAt)}
      </Link>
      <span className="flex items-center gap-3 text-sm">
        <Link href={`/holdings/${id}`} className="text-neutral-500 hover:text-black">
          notes &amp; photos
        </Link>
        {released && (
          <Link href={`/p/${slug}`} className="text-neutral-500 hover:text-black">
            see where it went &rarr;
          </Link>
        )}
      </span>
    </li>
  );
}
