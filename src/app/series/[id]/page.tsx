import Link from "next/link";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAuthClaims, isAdminEmail } from "@/lib/auth";
import { BEST_EFFORT_AUTH_TIMEOUT_MS } from "@/lib/with-timeout";
import { resolveHolderDisplayName } from "@/lib/timeline";
import { canRemoveSeriesItem } from "@/lib/series";
import { seriesTileStyle } from "@/lib/pin-card-style";
import { claimItem, unclaimItem, deleteSeriesItem, setClaimLinkedPin } from "@/app/series/actions";
import { AddSeriesItemForm } from "@/components/AddSeriesItemForm";
import { ConfirmButton } from "@/components/ConfirmButton";
import { EditModeButton, EditOnly, PinEditProvider, ViewOnly } from "@/components/PinEditMode";
import { CorkBoard } from "@/components/CorkBoard";
import { PinNamePill } from "@/components/PinNamePill";
import { PushPin } from "@/components/PushPin";
import { SeriesItemImageControl } from "@/components/SeriesItemImageControl";
import { LinkedPinSelect, type PinOption } from "@/components/LinkedPinSelect";
import { ViewToggle, type View } from "@/components/ViewToggle";

const searchParamsSchema = z.object({
  linkPin: z.string().max(64).optional(),
  // Whose checklist to show: a collector's public username, or "all" for the
  // plain catalog. Default: yours if signed in, the catalog otherwise.
  collector: z.string().max(64).optional(),
  view: z.enum(["all"]).optional(),
  // Cork board (default) or the plain list.
  layout: z.enum(["list"]).optional(),
});

// The buttons under each design: an enamel-pin "I have this!" (same gold
// outline and dark-gold drop edge as the name pills) and a smaller navy one.
const FUN_PRIMARY =
  "-rotate-2 whitespace-nowrap rounded-full border-[3px] border-gold bg-brand px-4 py-1.5 font-display text-sm font-bold uppercase tracking-wider text-cream shadow-[0_3px_0_#8E6E14,0_6px_7px_rgba(0,0,0,0.35)] transition-transform hover:-translate-y-0.5 hover:rotate-0 hover:bg-brand-hover active:translate-y-0.5";
const FUN_SECONDARY =
  "rotate-1 whitespace-nowrap rounded-full border-2 border-gold/70 bg-navy px-3 py-1 text-xs font-semibold text-cream shadow-[0_2px_0_#8E6E14] transition-transform hover:-translate-y-0.5 hover:rotate-0";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function SeriesDetailPage({ params, searchParams }: Props) {
  const { id } = await params;
  const rawParams = await searchParams;
  const parsed = searchParamsSchema.safeParse({
    linkPin: firstValue(rawParams.linkPin),
    collector: firstValue(rawParams.collector),
    view: firstValue(rawParams.view),
    layout: firstValue(rawParams.layout),
  });
  const { linkPin, collector, view, layout } = parsed.success ? parsed.data : {};
  const shape: View = layout === "list" ? "list" : "cork";

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

  // The pins the viewer holds right now: the "Which of your pins is it?"
  // picker, "Use my pin's photo", and your own photos on your own checklist.
  const myHoldings = viewerId
    ? await prisma.pinHolding.findMany({
        where: { userId: viewerId, releasedAt: null, pending: false },
        orderBy: { acquiredAt: "desc" },
        select: {
          id: true,
          pinId: true,
          pin: { select: { number: true } },
          title: { select: { title: true } },
          photos: { where: { kind: "FRONT" }, select: { id: true }, take: 1 },
        },
      })
    : [];
  const pinName = (h: (typeof myHoldings)[number]) => h.title?.title.trim() || "Untitled Pin";
  // The pin number goes last: it's only there to tell apart two pins with the
  // same name, not something anyone knows their pin by.
  const myPinOptions: PinOption[] = myHoldings.map((h) => ({ id: h.pinId, label: `${pinName(h)} (#${h.pin.number})` }));
  // Your holding's own (private, auth-gated) photo route — only you can load
  // it, which is exactly who sees your checklist with your photos on it.
  const myPinPhotoSrc = new Map(
    myHoldings
      .filter((h) => h.photos.length > 0)
      .map((h) => [h.pinId, `/api/holdings/${h.id}/photos/${h.photos[0].id}`] as const)
  );

  // Only offer to link linkPin if the viewer holds it — cosmetic pre-check for
  // the UI; the action re-validates, since this param is user-controlled.
  const linkPinHolding = linkPin ? myHoldings.find((h) => h.pinId === linkPin) : undefined;
  const canLinkPin = !!linkPinHolding;

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
  // Links between checklists keep the pin being linked and the chosen layout.
  const withLink = (qs: string) => {
    const p = new URLSearchParams(qs);
    if (linkPin) p.set("linkPin", linkPin);
    if (shape === "list") p.set("layout", "list");
    const s = p.toString();
    return s ? `${basePath}?${s}` : basePath;
  };

  type Item = (typeof series.items)[number];
  // Closures below lose the not-null narrowing on `series`.
  const seriesId = series.id;
  const seriesName = series.name;

  // Everything one design needs in either layout.
  function tileData(item: Item) {
    const ownClaim = viewerId ? item.claims.find((c) => c.userId === viewerId) : undefined;
    const has = subject ? item.claims.some((c) => c.userId === subject.userId) : true;
    const seriesSrc = item.imagePath
      ? `/api/series-items/${item.id}/image?v=${item.imageAddedAt?.getTime() ?? 0}`
      : undefined;
    // On your own checklist, a design linked to one of your pins shows YOUR
    // pin's photo (just for you). Everyone else sees the series picture.
    const personalSrc = subject?.isViewer && ownClaim?.linkedPinId ? myPinPhotoSrc.get(ownClaim.linkedPinId) : undefined;
    return { ownClaim, has, src: personalSrc ?? seriesSrc, isPersonal: !!personalSrc };
  }

  // The claim line, picker and buttons under a design.
  function controls(item: Item): ReactNode {
    const { ownClaim } = tileData(item);
    const others = item.claims.filter((c) => c.userId !== viewerId).map((c) => resolveHolderDisplayName(c.user));
    const canChangeImage = !!viewerId && (item.imageBy === viewerId || viewerIsAdmin);
    const canRemove = canRemoveSeriesItem(item, viewerId, viewerIsAdmin);
    const linkedHeld = ownClaim?.linkedPinId ? myHoldings.some((h) => h.pinId === ownClaim.linkedPinId) : false;

    return (
      <>
        <p className="text-xs text-neutral-500">
          {item.claims.length === 0
            ? "Nobody has claimed it yet"
            : others.length > 0
              ? `Have it: ${others.join(", ")}${ownClaim ? " (and you)" : ""}`
              : "You have this one"}
        </p>
        {ownClaim?.linkedPin && (
          <Link href={`/p/${ownClaim.linkedPin.number}`} className="text-xs text-accent hover:underline">
            See your pin &rarr;
          </Link>
        )}
        {ownClaim && (myPinOptions.length > 0 || ownClaim.linkedPin) && (
          <LinkedPinSelect
            action={setClaimLinkedPin.bind(null, seriesId, item.id)}
            itemLabel={item.label}
            value={ownClaim.linkedPinId ?? ""}
            options={
              // Keep a pin you've since traded away selectable, so the
              // picker still shows what it's linked to.
              ownClaim.linkedPinId && ownClaim.linkedPin && !linkedHeld
                ? [...myPinOptions, { id: ownClaim.linkedPinId, label: `A pin you no longer have (#${ownClaim.linkedPin.number})` }]
                : myPinOptions
            }
          />
        )}

        {viewerId ? (
          ownClaim ? (
            <div className="flex flex-wrap justify-center gap-2 pt-1">
              {canLinkPin && ownClaim.linkedPinId !== linkPin && (
                <form action={setClaimLinkedPin.bind(null, seriesId, item.id)}>
                  <input type="hidden" name="pinId" value={linkPin} />
                  <button type="submit" className={FUN_PRIMARY}>
                    It&apos;s this one!
                  </button>
                </form>
              )}
              <form action={unclaimItem.bind(null, seriesId, item.id)}>
                <button type="submit" className={FUN_SECONDARY}>
                  ✕ Remove from collection
                </button>
              </form>
            </div>
          ) : (
            <form action={claimItem.bind(null, seriesId, item.id)} className="pt-1">
              {canLinkPin && <input type="hidden" name="linkedPinId" value={linkPin} />}
              <button type="submit" className={FUN_PRIMARY}>
                {canLinkPin ? "It's this one!" : "I have this!"}
              </button>
            </form>
          )
        ) : (
          <Link href={`/sign-in?next=${encodeURIComponent(basePath)}`} className={FUN_SECONDARY}>
            Sign in to claim
          </Link>
        )}

        {viewerId && (
          <SeriesItemImageControl
            seriesId={seriesId}
            itemId={item.id}
            hasImage={!!item.imagePath}
            canChange={canChangeImage}
            // Offered when this design is linked to a pin you hold that has a photo.
            pinPhoto={ownClaim?.linkedPinId && myPinPhotoSrc.has(ownClaim.linkedPinId) ? { pinId: ownClaim.linkedPinId } : undefined}
          />
        )}
        {canRemove && (
          <EditOnly>
            <form action={deleteSeriesItem.bind(null, seriesId, item.id)} className="pt-1">
              <ConfirmButton
                message={`Take "${item.label}" out of ${seriesName}? Any claims on it go too.`}
                className="rounded-full border border-red-600/70 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-600 hover:text-white"
              >
                ✕ Remove from series
              </ConfirmButton>
            </form>
          </EditOnly>
        )}
      </>
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10">
      {/* "Edit series" mode: removing designs, adding new ones and changing
          existing pictures only show up after pressing it, so nothing gets
          taken out by a stray tap. (Later: subscribers only.) */}
      <PinEditProvider>
      <Link href="/series" className="text-sm text-neutral-500 hover:text-white">
        &larr; All series
      </Link>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="mt-2 text-2xl font-semibold">{series.name}</h1>
          <p className="mt-1 text-sm text-neutral-600">
            {total} pin{total === 1 ? "" : "s"} in this series · {collectors.length} collector
            {collectors.length === 1 ? "" : "s"}
          </p>
        </div>

        {/* The unopened blind box (Series.boxImagePath): a snapshot pinned up
            beside the title, or, with none yet, an offer to add one. */}
        {series.boxImagePath ? (
          <figure className="flex w-52 shrink-0 flex-col items-center gap-3 self-center sm:w-64 sm:self-start lg:w-80">
            <div className="relative w-48 rotate-3 rounded-sm bg-cream p-2 pb-1 sm:w-60 lg:w-72 lg:p-3 lg:pb-1 ring-[3px] ring-gold shadow-[0_4px_0_#8E6E14,0_9px_10px_rgba(0,0,0,0.42)]">
              <PushPin color="#B13F3A" className="-top-2 left-1/2 z-10 -translate-x-1/2" />
              {/* eslint-disable-next-line @next/next/no-img-element -- public series image route */}
              <img
                src={`/api/series/${series.id}/box-image?v=${series.boxImageAddedAt?.getTime() ?? 0}`}
                alt={`The unopened ${series.name} blind box`}
                className="aspect-square w-full object-cover"
              />
              <figcaption className="text-center font-hand text-xl leading-8 text-ink lg:text-2xl lg:leading-10">The blind box</figcaption>
            </div>
            {viewerId && (
              <SeriesItemImageControl
                seriesId={seriesId}
                itemId={null}
                hasImage
                canChange={series.boxImageBy === viewerId || viewerIsAdmin}
              />
            )}
          </figure>
        ) : (
          viewerId && (
            <div className="flex w-full flex-col items-center gap-1 rounded-md border-2 border-dashed border-neutral-300 px-4 py-3 text-center sm:w-56">
              <p className="text-sm text-neutral-600">📦 Sold in blind boxes?</p>
              <SeriesItemImageControl
                seriesId={seriesId}
                itemId={null}
                hasImage={false}
                canChange
                addLabel="+ Add a picture of the unopened box"
              />
            </div>
          )
        )}
      </div>

      {linkPinHolding && (
        <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Linking your pin <strong>{pinName(linkPinHolding)}</strong>: tap <strong>It&apos;s this one!</strong> on the
          design it is, and its page will say it&apos;s part of this series.
        </p>
      )}

      {/* Whose checklist (yours, everything, or a collector's from the list
          below) and how to show it. */}
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
        {total > 0 && (
          <ViewToggle
            view={shape}
            basePath={basePath}
            param="layout"
            params={{ view: subject ? undefined : view, collector: subject && !subject.isViewer ? collector : undefined, linkPin }}
          />
        )}
        {viewerId && <EditModeButton label="Edit series" className="sm:ml-auto" />}
      </div>
      {subject && (
        <p className="mt-3 text-sm text-neutral-600">
          {subject.label} checklist: <strong className="text-cream">{subjectCount}</strong> of {total}
          {total > 0 && subjectCount < total && " — the see-through ones aren't collected yet"}
          {subject.isViewer && myPinPhotoSrc.size > 0 && (
            <span className="block text-xs text-neutral-500">
              Designs linked to your pins show your own photos here. Only you see those; everyone else sees the series
              picture.
            </span>
          )}
        </p>
      )}

      {total === 0 ? (
        <p className="mt-6 text-neutral-600">No pins added yet — be the first.</p>
      ) : shape === "cork" ? (
        <CorkBoard className="mt-6 px-4 py-10 sm:px-8">
          <ul className="grid grid-cols-1 justify-items-center gap-x-6 gap-y-12 min-[460px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {series.items.map((item) => {
              const { has, src, isPersonal } = tileData(item);
              const { tilt, pinColor, pillColor } = seriesTileStyle(item.id);
              return (
                <li key={item.id} className="flex w-full max-w-[15rem] flex-col items-center gap-4">
                  <div className="relative w-full max-w-[11rem]" style={{ transform: `rotate(${tilt}deg)` }}>
                    {has ? (
                      <div className="relative rounded-sm bg-cream p-2 ring-[3px] ring-gold shadow-[0_4px_0_#8E6E14,0_9px_10px_rgba(0,0,0,0.42)]">
                        <PushPin color={pinColor} className="-top-2 left-1/2 z-10 -translate-x-1/2" />
                        <TileMedia src={src} label={item.label} position={item.position} />
                        {isPersonal && <YourPhotoTag />}
                      </div>
                    ) : (
                      // Not collected: just the outline of where it'll go.
                      <div className="relative rounded-sm border-[3px] border-dashed border-cream/80 bg-cream/15 p-2">
                        <PushPin color={pinColor} className="-top-2 left-1/2 z-10 -translate-x-1/2 opacity-60" />
                        <TileMedia src={src} label={item.label} position={item.position} faded />
                        <span className="absolute inset-0 flex items-center justify-center px-3 text-center font-hand text-2xl leading-7 text-cream [text-shadow:0_2px_4px_rgba(0,0,0,0.7)]">
                          Not collected yet
                        </span>
                      </div>
                    )}
                    {has && subject && (
                      <span className="absolute -right-3 -top-3 z-10 rotate-12 rounded-full border-2 border-gold bg-green-700 px-2 py-0.5 text-xs font-bold text-navy shadow-[0_2px_0_#8E6E14]">
                        ✓ Got it
                      </span>
                    )}
                  </div>
                  <PinNamePill as="h2" size="sm" color={pillColor}>
                    {item.position != null && `${item.position}. `}
                    {item.label}
                  </PinNamePill>
                  <div className="flex w-full flex-col items-center gap-1.5 rounded-lg bg-navy/90 px-3 py-2.5 text-center shadow-lg">
                    {controls(item)}
                  </div>
                </li>
              );
            })}
          </ul>
        </CorkBoard>
      ) : (
        <ul className="mt-6 divide-y divide-neutral-200">
          {series.items.map((item) => {
            const { has, src, isPersonal } = tileData(item);
            return (
              <li key={item.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start">
                <div className="flex flex-1 items-start gap-3">
                  <div
                    className={`relative size-20 flex-shrink-0 overflow-hidden rounded-md ${
                      has ? "ring-2 ring-gold" : "border-2 border-dashed border-neutral-400"
                    }`}
                  >
                    <TileMedia src={src} label={item.label} position={item.position} faded={!has} small />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <p className="font-medium leading-tight">
                      {item.position != null && <span className="text-neutral-500">{item.position}. </span>}
                      {item.label}
                    </p>
                    {subject && (
                      <p className={`text-xs font-semibold ${has ? "text-green-700" : "text-neutral-500"}`}>
                        {has ? "✓ Got it" : "Not collected yet"}
                      </p>
                    )}
                    {isPersonal && <p className="text-[11px] text-neutral-500">Showing your pin&apos;s photo</p>}
                  </div>
                </div>
                <div className="flex flex-col items-center gap-1.5 text-center sm:w-64">{controls(item)}</div>
              </li>
            );
          })}
        </ul>
      )}

      {viewerId && total > 0 ? (
        <>
          <EditOnly>
            <div className="mt-8">
              <AddSeriesItemForm seriesId={series.id} />
            </div>
          </EditOnly>
          <ViewOnly>
            <p className="mt-8 text-sm text-neutral-500">
              Missing a design, or need to take one out? Press <strong className="text-cream">Edit series</strong>{" "}
              above.
            </p>
          </ViewOnly>
        </>
      ) : (
        <div className="mt-8">
          <AddSeriesItemForm seriesId={series.id} />
        </div>
      )}

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
      </PinEditProvider>
    </main>
  );
}

// The picture on a design: your pin's photo, the series picture, or a
// placeholder. `faded` for one that isn't collected yet.
function TileMedia({
  src,
  label,
  position,
  faded = false,
  small = false,
}: {
  src?: string;
  label: string;
  position: number | null;
  faded?: boolean;
  small?: boolean;
}) {
  return (
    <div className={`flex aspect-square w-full items-center justify-center overflow-hidden ${faded ? "" : "bg-navy"}`}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- served through our own photo routes
        <img src={src} alt={label} className={`size-full object-cover ${faded ? "opacity-25 grayscale" : ""}`} />
      ) : (
        <span
          className={`px-2 text-center font-display font-bold uppercase ${small ? "text-[10px]" : "text-sm"} ${
            faded ? "text-cream/40" : "text-neutral-500"
          }`}
        >
          {position != null ? `#${position}` : "No picture yet"}
        </span>
      )}
    </div>
  );
}

function YourPhotoTag() {
  return (
    <span className="absolute bottom-3 left-3 rounded-full bg-navy/85 px-2 py-0.5 text-[10px] font-semibold text-cream">
      Your pin
    </span>
  );
}

function firstValue(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}
