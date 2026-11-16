import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAuthClaims, isAdminEmail } from "@/lib/auth";
import { BEST_EFFORT_AUTH_TIMEOUT_MS } from "@/lib/with-timeout";
import { resolveHolderDisplayName } from "@/lib/timeline";
import { claimItem, unclaimItem, deleteSeriesItem, setClaimLinkedPin } from "@/app/series/actions";
import { AddSeriesItemForm } from "@/components/AddSeriesItemForm";
import { SeriesItemImageControl } from "@/components/SeriesItemImageControl";
import { LinkedPinSelect, type PinOption } from "@/components/LinkedPinSelect";

const searchParamsSchema = z.object({
  linkPin: z.string().max(64).optional(),
  // Whose checklist to show: a collector's public username, or "all" for the
  // plain catalog. Default: yours if signed in, the catalog otherwise.
  collector: z.string().max(64).optional(),
  view: z.enum(["all"]).optional(),
});

type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function SeriesDetailPage({ params, searchParams }: Props) {
  const { id } = await params;
  const rawParams = await searchParams;
  const parsed = searchParamsSchema.safeParse({
    linkPin: firstValue(rawParams.linkPin),
    collector: firstValue(rawParams.collector),
    view: firstValue(rawParams.view),
  });
  const { linkPin, collector, view } = parsed.success ? parsed.data : {};

  const series = await prisma.series.findUnique({
    where: { id },
    include: {
      items: {
        orderBy: [{ position: "asc" }, { label: "asc" }],
        include: {
          claims: {
            include: {
              user: { select: { id: true, username: true, showNamePublicly: true } },
              linkedPin: { select: { number: true } },
            },
          },
        },
      },
    },
  });
  if (!series) notFound();

  // Best-effort — browsing this page must never stall on a slow auth check
  // (same reasoning as /p/[number]). Failing open to "logged out" just hides
  // the claim/unclaim controls for this one request.
  const claims = await getAuthClaims(BEST_EFFORT_AUTH_TIMEOUT_MS);
  const viewerId = claims?.sub;
  const viewerIsAdmin = isAdminEmail(claims?.email);

  // Only offer to link linkPin if the viewer actually has some holding on
  // it — cosmetic pre-check for the UI; the action itself re-validates
  // regardless, since this param is user-controlled.
  const linkPinRow =
    viewerId && linkPin
      ? await prisma.pinHolding.findFirst({
          where: { pinId: linkPin, userId: viewerId },
          select: { pin: { select: { number: true } } },
        })
      : null;
  const canLinkPin = !!linkPinRow;

  // The pins the viewer holds right now, for the "Which of your pins is it?"
  // picker on each design they've claimed, and for "Use my pin's photo".
  const myHoldings = viewerId
    ? await prisma.pinHolding.findMany({
        where: { userId: viewerId, releasedAt: null, pending: false },
        orderBy: { acquiredAt: "desc" },
        select: {
          pinId: true,
          pin: { select: { number: true } },
          title: { select: { title: true } },
          photos: { where: { kind: "FRONT" }, select: { id: true }, take: 1 },
        },
      })
    : [];
  const myPinOptions: PinOption[] = myHoldings.map((h) => ({
    id: h.pinId,
    label: `#${h.pin.number} ${h.title?.title.trim() || "Untitled Pin"}`,
  }));
  const myPinsWithPhoto = new Map(
    myHoldings.filter((h) => h.photos.length > 0).map((h) => [h.pinId, h.pin.number] as const)
  );

  // Everyone with at least one piece of this series. A collector who hides
  // their name is counted but never named or linked (same rule as the rest of
  // the site: username only when show_name_publicly).
  const collectorMap = new Map<string, { userId: string; name: string; isPublic: boolean; count: number }>();
  for (const item of series.items) {
    for (const c of item.claims) {
      const entry = collectorMap.get(c.userId) ?? {
        userId: c.userId,
        name: resolveHolderDisplayName(c.user),
        isPublic: c.user.showNamePublicly && !!c.user.username,
        count: 0,
      };
      entry.count += 1;
      collectorMap.set(c.userId, entry);
    }
  }
  const collectors = [...collectorMap.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  const total = series.items.length;

  // Whose checklist the tiles show. A named collector must be public; an
  // unknown or hidden name falls back to the plain catalog.
  let subject: { userId: string; label: string; isViewer: boolean } | null = null;
  if (collector) {
    const found = collectors.find((c) => c.isPublic && c.name.toLowerCase() === collector.toLowerCase());
    if (found) subject = { userId: found.userId, label: `${found.name}'s`, isViewer: found.userId === viewerId };
  } else if (viewerId && view !== "all") {
    subject = { userId: viewerId, label: "Your", isViewer: true };
  }
  const subjectCount = subject ? (collectorMap.get(subject.userId)?.count ?? 0) : 0;
  const basePath = `/series/${series.id}`;
  const withLink = (qs: string) => {
    const p = new URLSearchParams(qs);
    if (linkPin) p.set("linkPin", linkPin);
    const s = p.toString();
    return s ? `${basePath}?${s}` : basePath;
  };

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10">
      <Link href="/series" className="text-sm text-neutral-500 hover:text-white">
        &larr; All series
      </Link>
      <h1 className="mt-2 text-2xl font-semibold">{series.name}</h1>
      <p className="mt-1 text-sm text-neutral-600">
        {total} pin{total === 1 ? "" : "s"} in this series · {collectors.length} collector
        {collectors.length === 1 ? "" : "s"}
      </p>

      {canLinkPin && (
        <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Linking pin #{linkPinRow!.pin.number}: tap <strong>I have this</strong> (or <strong>Link my pin</strong>) on
          the design it is, and its page will say it&apos;s part of this series.
        </p>
      )}

      {/* Whose checklist: yours, everything, or a collector's (from the list below). */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div role="group" aria-label="Checklist" className="flex overflow-hidden rounded-md border border-neutral-300 text-sm font-medium">
          {viewerId && (
            <Link
              href={withLink("")}
              aria-current={subject?.isViewer && !collector ? "page" : undefined}
              className={`px-3 py-1.5 ${subject?.isViewer && !collector ? "bg-brand text-white" : "text-neutral-700 hover:bg-neutral-50"}`}
            >
              My checklist
            </Link>
          )}
          <Link
            href={withLink(viewerId ? "view=all" : "")}
            aria-current={!subject ? "page" : undefined}
            className={`px-3 py-1.5 ${!subject ? "bg-brand text-white" : "text-neutral-700 hover:bg-neutral-50"}`}
          >
            All pins
          </Link>
        </div>
        {subject && (
          <p className="text-sm text-neutral-600">
            {subject.label} checklist: <strong className="text-cream">{subjectCount}</strong> of {total}
            {total > 0 && subjectCount < total && " — dotted outlines are the ones still missing"}
          </p>
        )}
      </div>

      {total === 0 ? (
        <p className="mt-6 text-neutral-600">No pins added yet — be the first.</p>
      ) : (
        <ul className="mt-6 grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">
          {series.items.map((item) => {
            const ownClaim = viewerId ? item.claims.find((c) => c.userId === viewerId) : undefined;
            const has = subject ? item.claims.some((c) => c.userId === subject.userId) : true;
            const others = item.claims.filter((c) => c.userId !== viewerId).map((c) => resolveHolderDisplayName(c.user));
            const canDelete = viewerId === item.createdBy && item.claims.length === 0;
            const canChangeImage = !!viewerId && (item.imageBy === viewerId || viewerIsAdmin);
            const imgVersion = item.imageAddedAt?.getTime() ?? 0;

            return (
              <li key={item.id} className="flex flex-col items-center gap-2 text-center">
                <div
                  className={`relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-lg ${
                    has ? "bg-cream ring-[3px] ring-gold" : "border-[3px] border-dashed border-neutral-400 bg-transparent"
                  }`}
                >
                  {item.imagePath ? (
                    // eslint-disable-next-line @next/next/no-img-element -- served through a dedicated public route
                    <img
                      src={`/api/series-items/${item.id}/image?v=${imgVersion}`}
                      alt={item.label}
                      className={`size-full object-cover ${has ? "" : "opacity-40 grayscale"}`}
                    />
                  ) : (
                    <span className={`px-2 font-display text-sm font-bold uppercase ${has ? "text-ink/60" : "text-neutral-500"}`}>
                      {item.position != null ? `#${item.position}` : "No picture yet"}
                    </span>
                  )}
                  {has && subject && (
                    <span className="absolute right-1.5 top-1.5 rounded-full bg-green-700 px-2 py-0.5 text-[11px] font-bold text-white shadow">
                      ✓ Have
                    </span>
                  )}
                </div>

                <p className="font-medium leading-tight">
                  {item.position != null && <span className="text-neutral-500">{item.position}. </span>}
                  {item.label}
                </p>
                <p className="text-xs text-neutral-500">
                  {item.claims.length === 0
                    ? "Nobody has claimed it yet"
                    : others.length > 0
                      ? `Have it: ${others.join(", ")}${ownClaim ? " (and you)" : ""}`
                      : "You have this one"}
                </p>
                {ownClaim?.linkedPin && (
                  <Link href={`/p/${ownClaim.linkedPin.number}`} className="text-xs text-accent hover:underline">
                    Linked to your pin #{ownClaim.linkedPin.number} &rarr;
                  </Link>
                )}
                {ownClaim && (myPinOptions.length > 0 || ownClaim.linkedPin) && (
                  <LinkedPinSelect
                    action={setClaimLinkedPin.bind(null, series.id, item.id)}
                    itemLabel={item.label}
                    value={ownClaim.linkedPinId ?? ""}
                    options={
                      // Keep a pin you've since traded away selectable, so the
                      // picker still shows what it's linked to.
                      ownClaim.linkedPinId && ownClaim.linkedPin && !myPinOptions.some((o) => o.id === ownClaim.linkedPinId)
                        ? [...myPinOptions, { id: ownClaim.linkedPinId, label: `#${ownClaim.linkedPin.number} (no longer yours)` }]
                        : myPinOptions
                    }
                  />
                )}

                {viewerId ? (
                  ownClaim ? (
                    <div className="flex flex-wrap justify-center gap-2">
                      {canLinkPin && ownClaim.linkedPinId !== linkPin && (
                        <form action={setClaimLinkedPin.bind(null, series.id, item.id)}>
                          <input type="hidden" name="pinId" value={linkPin} />
                          <button
                            type="submit"
                            className="rounded-md bg-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-hover"
                          >
                            Link my pin #{linkPinRow!.pin.number}
                          </button>
                        </form>
                      )}
                      <form action={unclaimItem.bind(null, series.id, item.id)}>
                        <button
                          type="submit"
                          className="whitespace-nowrap rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
                        >
                          ✓ Remove my claim
                        </button>
                      </form>
                    </div>
                  ) : (
                    <form action={claimItem.bind(null, series.id, item.id)}>
                      {canLinkPin && <input type="hidden" name="linkedPinId" value={linkPin} />}
                      <button
                        type="submit"
                        className="whitespace-nowrap rounded-md bg-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-hover"
                      >
                        I have this
                      </button>
                    </form>
                  )
                ) : (
                  <Link href={`/sign-in?next=${encodeURIComponent(basePath)}`} className="text-xs text-accent hover:underline">
                    Sign in to claim
                  </Link>
                )}

                {viewerId && (
                  <SeriesItemImageControl
                    seriesId={series.id}
                    itemId={item.id}
                    hasImage={!!item.imagePath}
                    canChange={canChangeImage}
                    // Offered when this design is linked to a pin you hold
                    // that has a photo.
                    pinPhoto={
                      ownClaim?.linkedPinId && myPinsWithPhoto.has(ownClaim.linkedPinId)
                        ? { pinId: ownClaim.linkedPinId, pinNumber: myPinsWithPhoto.get(ownClaim.linkedPinId)! }
                        : undefined
                    }
                  />
                )}
                {canDelete && (
                  <form action={deleteSeriesItem.bind(null, series.id, item.id)}>
                    <button type="submit" className="text-xs text-neutral-400 hover:text-red-600 hover:underline">
                      Remove (added by you, unclaimed)
                    </button>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-8">
        <AddSeriesItemForm seriesId={series.id} />
      </div>

      <section className="mt-12" id="collectors">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Who collects this series</h2>
        <p className="mt-1 text-xs text-neutral-500">
          Claims are self-reported, like everything else on Wandering Pins — nothing here verifies someone actually has a
          piece. It&apos;s a public checklist for finding trade partners. Tap a name to see their checklist.
        </p>
        {collectors.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-600">Nobody yet.</p>
        ) : (
          <ul className="mt-3 flex flex-wrap gap-2">
            {collectors.map((c) => {
              const text = (
                <>
                  {c.userId === viewerId ? "You" : c.name} · {c.count} of {total}
                </>
              );
              const cls = "rounded-full border border-neutral-300 px-3 py-1.5 text-sm";
              return (
                <li key={c.userId}>
                  {c.isPublic || c.userId === viewerId ? (
                    <Link
                      href={c.userId === viewerId ? withLink("") : withLink(`collector=${encodeURIComponent(c.name)}`)}
                      className={`${cls} block text-neutral-700 hover:bg-neutral-50`}
                    >
                      {text}
                    </Link>
                  ) : (
                    <span className={`${cls} block text-neutral-500`}>{text}</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}

function firstValue(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}
