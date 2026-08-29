import Link from "next/link";
import type { AcquiredVia } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAppUser } from "@/lib/auth";
import { formatAcquisition } from "@/lib/timeline";
import { PinLookupForm } from "@/components/PinLookupForm";

export default async function MyPinsPage() {
  const user = await requireAppUser("/my-pins");

  const holdings = await prisma.pinHolding.findMany({
    where: { userId: user.id },
    include: { pin: true, title: true, photos: { where: { kind: "FRONT" }, take: 1 } },
    orderBy: { acquiredAt: "desc" },
  });

  const currentlyHave = holdings.filter((h) => h.releasedAt === null);
  const everHad = holdings;

  // "Current location" for a released holding means wherever the pin is
  // now — which may belong to a different stint of this same user's, a
  // different person entirely, or no one. One query for every pin involved
  // covers both cases: a still-open holding maps to its own place label for
  // free, and a released one gets whatever open holding (if any) exists now.
  const pinIds = [...new Set(holdings.map((h) => h.pinId))];
  const openHoldings = await prisma.pinHolding.findMany({
    where: { pinId: { in: pinIds }, releasedAt: null },
    select: { pinId: true, placeLabel: true },
  });
  const currentLocationByPinId = new Map(openHoldings.map((h) => [h.pinId, h.placeLabel]));

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
              <HoldingRow
                key={h.id}
                id={h.id}
                slug={h.pin.slug}
                placeLabel={h.placeLabel}
                title={h.title?.title}
                acquiredAt={h.acquiredAt}
                acquiredVia={h.acquiredVia}
                currentLocation={currentLocationByPinId.get(h.pinId) ?? null}
                photoId={h.photos[0]?.id}
              />
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
                title={h.title?.title}
                acquiredAt={h.acquiredAt}
                acquiredVia={h.acquiredVia}
                currentLocation={currentLocationByPinId.get(h.pinId) ?? null}
                released={h.releasedAt !== null}
                photoId={h.photos[0]?.id}
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
  title,
  acquiredAt,
  acquiredVia,
  currentLocation,
  released,
  photoId,
}: {
  id: string;
  slug: string;
  placeLabel: string;
  title?: string;
  acquiredAt: Date;
  acquiredVia: AcquiredVia;
  currentLocation: string | null;
  released?: boolean;
  photoId?: string;
}) {
  return (
    <li className="flex items-start gap-3 py-3">
      {photoId ? (
        // eslint-disable-next-line @next/next/no-img-element -- private, per-user image behind an auth-gated route, same as the holding detail page
        <img
          src={`/api/holdings/${id}/photos/${photoId}`}
          alt=""
          className="h-16 w-16 flex-shrink-0 rounded-md object-cover"
        />
      ) : (
        <div className="h-16 w-16 flex-shrink-0 rounded-md bg-neutral-100" aria-hidden />
      )}
      <div className="flex flex-1 flex-col gap-0.5">
        <Link href={`/p/${slug}`} className="font-medium hover:underline">
          {title || placeLabel}
        </Link>
        <p className="text-sm text-neutral-600">{formatAcquisition(acquiredVia, placeLabel, acquiredAt)}</p>
        <p className="text-sm text-neutral-600">
          {released ? (
            currentLocation ? (
              <>Now in {currentLocation}</>
            ) : (
              "Not currently held by anyone"
            )
          ) : (
            <>Currently in {currentLocation}</>
          )}
        </p>
        <span className="mt-1 flex items-center gap-3 text-sm">
          <Link href={`/holdings/${id}`} className="text-neutral-500 hover:text-black">
            notes &amp; photos
          </Link>
          {released && (
            <Link href={`/p/${slug}`} className="text-neutral-500 hover:text-black">
              see where it went &rarr;
            </Link>
          )}
        </span>
      </div>
    </li>
  );
}
