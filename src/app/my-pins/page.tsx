import Link from "next/link";
import type { ReactNode } from "react";
import type { AcquiredVia } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAppUser } from "@/lib/auth";
import { formatAcquisition } from "@/lib/timeline";
import { CorkWall } from "@/components/CorkWall";
import { HoldingCard } from "@/components/HoldingCard";
import { PinLookupForm } from "@/components/PinLookupForm";
import { ViewToggle, type View } from "@/components/ViewToggle";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

type Kind = "current" | "pending" | "ever";

export default async function MyPinsPage({ searchParams }: Props) {
  const user = await requireAppUser("/my-pins");

  // Same default and URL convention as /pins: cork unless ?view=list.
  const rawView = (await searchParams).view;
  const view: View = (Array.isArray(rawView) ? rawView[0] : rawView) === "list" ? "list" : "cork";

  const holdings = await prisma.pinHolding.findMany({
    where: { userId: user.id },
    include: { pin: { include: { sticker: true } }, title: true, photos: { where: { kind: "FRONT" }, take: 1 } },
    orderBy: { acquiredAt: "desc" },
  });

  const currentlyHave = holdings.filter((h) => h.releasedAt === null && !h.pending);
  const pendingClaims = holdings.filter((h) => h.pending);
  const everHad = holdings.filter((h) => !h.pending);

  // "Current location" for a released holding means wherever the pin is
  // now — which may belong to a different stint of this same user's, a
  // different person entirely, or no one. One query for every pin involved
  // covers both cases: a still-open holding maps to its own place label for
  // free, and a released one gets whatever open holding (if any) exists now.
  // pending: false — a tentative claim elsewhere isn't a real "current
  // location" and shouldn't be reported as one.
  const pinIds = [...new Set(holdings.map((h) => h.pinId))];
  const openHoldings = await prisma.pinHolding.findMany({
    where: { pinId: { in: pinIds }, releasedAt: null, pending: false },
    select: { pinId: true, placeLabel: true },
  });
  const currentLocationByPinId = new Map(openHoldings.map((h) => [h.pinId, h.placeLabel]));

  // Props both views share, per section: a pending claim has no real current
  // location, and only "Ever had" distinguishes released from still-held.
  const baseProps = (h: (typeof holdings)[number], kind: Kind) => ({
    id: h.id,
    pinNumber: h.pin.number,
    // The sticker code is only ever shown for a pin you currently hold.
    stickerLine: kind === "current" ? (h.pin.sticker ? `Sticker ${h.pin.sticker.code}` : "No sticker yet") : null,
    placeLabel: h.placeLabel,
    acquiredAt: h.acquiredAt,
    acquiredVia: h.acquiredVia,
    currentLocation: kind === "pending" ? null : (currentLocationByPinId.get(h.pinId) ?? null),
    released: kind === "ever" ? h.releasedAt !== null : undefined,
    pending: kind === "pending" ? true : undefined,
  });

  const render = (items: typeof holdings, kind: Kind) =>
    view === "list" ? (
      <ul className="mt-3 divide-y divide-neutral-200">
        {items.map((h) => (
          <HoldingRow key={h.id} {...baseProps(h, kind)} title={h.title?.title} photoId={h.photos[0]?.id} />
        ))}
      </ul>
    ) : (
      <CorkWall className="mt-3">
        {items.map((h) => (
          <li key={h.id}>
            <HoldingCard
              {...baseProps(h, kind)}
              title={h.title?.title.trim() || h.placeLabel}
              description={h.title?.description?.trim() || ""}
              photoSrc={h.photos[0] ? `/api/holdings/${h.id}/photos/${h.photos[0].id}` : undefined}
            />
          </li>
        ))}
      </CorkWall>
    );

  return (
    <main className="pb-10">
      <div className="mx-auto max-w-2xl px-4 pt-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">My pins</h1>
          <ViewToggle view={view} basePath="/my-pins" />
        </div>

        <section className="mt-6 rounded-lg border border-neutral-200 p-4">
          <h2 className="text-sm font-semibold text-neutral-700">Got a new pin?</h2>
          <p className="mt-1 text-sm text-neutral-600">
            Scan the sticker on the back, or type its code below, to register it to your account or attach it to a
            pin you already have.
          </p>
          <div className="mt-3 max-w-sm">
            <PinLookupForm />
          </div>
          <p className="mt-3 text-sm text-neutral-600">
            No sticker yet?{" "}
            <Link href="/pins/new" className="text-accent hover:underline">
              Add a pin without one
            </Link>
            .
          </p>
        </section>
      </div>

      <Section className="mt-8" title="Currently have" view={view} count={currentlyHave.length} emptyText="Nothing right now.">
        {render(currentlyHave, "current")}
      </Section>

      {pendingClaims.length > 0 && (
        <Section
          className="mt-10"
          title="Pending"
          note={
            <p className="mt-1 text-xs text-neutral-500">
              Unreleased — the current holder hasn&apos;t let these go yet, so they won&apos;t show up on the public
              journey until they do.
            </p>
          }
          view={view}
          count={pendingClaims.length}
          emptyText=""
        >
          {render(pendingClaims, "pending")}
        </Section>
      )}

      <Section className="mt-10" title="Ever had" view={view} count={everHad.length} emptyText="No pins yet.">
        {render(everHad, "ever")}
      </Section>
    </main>
  );
}

// A titled section. The heading, note and empty message sit in the page's
// narrow column; the list view stays in that column too, but the cork board
// runs full width like it does on /pins.
function Section({
  title,
  note,
  view,
  count,
  emptyText,
  className,
  children,
}: {
  title: string;
  note?: ReactNode;
  view: View;
  count: number;
  emptyText: string;
  className: string;
  children: ReactNode;
}) {
  return (
    <section className={className}>
      <div className="mx-auto max-w-2xl px-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">{title}</h2>
        {note}
        {count === 0 ? <p className="mt-3 text-neutral-600">{emptyText}</p> : view === "list" ? children : null}
      </div>
      {count > 0 && view === "cork" && children}
    </section>
  );
}

function HoldingRow({
  id,
  pinNumber,
  stickerLine,
  placeLabel,
  title,
  acquiredAt,
  acquiredVia,
  currentLocation,
  released,
  pending,
  photoId,
}: {
  id: string;
  pinNumber: number;
  stickerLine: string | null;
  placeLabel: string;
  title?: string;
  acquiredAt: Date;
  acquiredVia: AcquiredVia;
  currentLocation: string | null;
  released?: boolean;
  pending?: boolean;
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
        <Link href={`/p/${pinNumber}`} className="font-medium hover:underline">
          {title || placeLabel}
        </Link>
        <p className="font-mono text-xs text-neutral-400">
          Pin #{pinNumber}
          {stickerLine && ` · ${stickerLine}`}
        </p>
        <p className="text-sm text-neutral-600">{formatAcquisition(acquiredVia, placeLabel, acquiredAt)}</p>
        <p className="text-sm text-neutral-600">
          {pending ? (
            "⏳ Unreleased — waiting for the current holder to let it go"
          ) : released ? (
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
          <Link href={`/holdings/${id}`} className="text-neutral-500 hover:text-white">
            notes &amp; photos
          </Link>
          {released && (
            <Link href={`/p/${pinNumber}`} className="text-neutral-500 hover:text-white">
              see where it went &rarr;
            </Link>
          )}
        </span>
      </div>
    </li>
  );
}
