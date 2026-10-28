import Link from "next/link";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { parseSlug } from "@/lib/slug";
import { getAuthClaims } from "@/lib/auth";
import { BEST_EFFORT_AUTH_TIMEOUT_MS } from "@/lib/with-timeout";
import {
  acquisitionKicker,
  buildJourneyRows,
  CHECK_IN_KICKER,
  formatMonthYear,
  resolveHolderDisplayName,
} from "@/lib/timeline";
import { toPublicHolding, toPublicCheckIn } from "@/lib/public-pin";
import { pinCardStyle } from "@/lib/pin-card-style";
import { PinJourneyTimeline, type TimelineLine } from "@/components/PinJourneyTimeline";
import { PinJourneyMap } from "@/components/PinJourneyMap";
import { MapFrame } from "@/components/MapFrame";
import { VerifiedStar } from "@/components/VerifiedStar";
import { InlineHoldingDetails } from "@/components/InlineHoldingDetails";
import { InlineCheckInDetails } from "@/components/InlineCheckInDetails";
import { CorkBoard } from "@/components/CorkBoard";
import { PinNamePill } from "@/components/PinNamePill";
import { PinTitleWidget } from "@/components/PinTitleWidget";
import { PinPhotoFrame } from "@/components/PinPhotoFrame";
import { PinPhotoWidget } from "@/components/PinPhotoWidget";
import { PinNote } from "@/components/PinNote";
import { EditOnly, EditPinSticker, PinEditProvider } from "@/components/PinEditMode";
import { TornPaper } from "@/components/TornPaper";
import { VerifyLocationButton } from "@/components/VerifyLocationButton";
import { verifyHoldingLocation } from "@/app/holdings/[holdingId]/actions";
import { verifyCheckInLocation } from "@/app/holdings/[holdingId]/checkin-actions";

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
        // A secondary sort key so ties on acquiredAt (same-day registration,
        // near-simultaneous claims) don't leave "the latest" ambiguous — id
        // is cuid-monotonic, so it breaks ties in creation order.
        orderBy: [{ acquiredAt: "asc" }, { id: "asc" }],
        // title/photos/note/checkIns are loaded here for convenience but
        // never touch toPublicHolding/toPublicCheckIn below — see the
        // dedicated public-title/photo section further down, and the
        // inline per-row "add details" widgets (owner-gated), for the only
        // places these leave this file.
        include: {
          user: true,
          title: true,
          photos: true,
          note: true,
          checkIns: { orderBy: { loggedAt: "asc" }, include: { note: true, photos: true } },
        },
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

  // A pending (tentative, not-yet-released) holding is structurally kept out
  // of every public computation below — it's not the real journey yet. Only
  // `confirmedHoldings` ever feeds toPublicHolding/toPublicCheckIn, the
  // timeline, the map, or the public title/photo.
  const confirmedHoldings = pin.holdings.filter((h) => !h.pending);

  const publicHoldings = confirmedHoldings.map(toPublicHolding);
  const publicCheckIns = confirmedHoldings.flatMap((h) =>
    h.checkIns.map((c) => toPublicCheckIn({ ...c, holder: h.user }))
  );
  const points = [
    ...publicHoldings.map((h) => ({ at: h.acquiredAt, lat: h.lat, lng: h.lng, label: h.placeLabel })),
    ...publicCheckIns.map((c) => ({ at: c.loggedAt, lat: c.lat, lng: c.lng, label: c.placeLabel })),
  ]
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .map(({ lat, lng, label }) => ({ lat, lng, label }));

  // At most one CONFIRMED open holding per pin (partial unique index —
  // release is atomic and one-sided, brief section 6.4, so there's never an
  // overlap, only a gap between someone releasing and someone else
  // claiming). A pending claim on the same pin can coexist and is handled
  // separately below.
  const openHolding = confirmedHoldings.find((h) => h.releasedAt === null);
  // Best-effort — this is the public funnel page, so a signed-in visitor's
  // stalled auth check must never stall the page itself. Failing open to
  // "anonymous" just means the CTA below defaults to "Claim this pin"
  // instead of "Log a trade"/pending-claim messaging, and no inline "add
  // details" widgets render, for this one request.
  const claims = await getAuthClaims(BEST_EFFORT_AUTH_TIMEOUT_MS);
  const isCurrentHolder = !!claims && claims.sub === openHolding?.userId;
  // Gets the "Edit pin information" sticker: the current holder, and anyone who
  // owns an earlier line of this journey (they can still edit their own notes).
  const canEdit = !!claims && confirmedHoldings.some((h) => h.userId === claims.sub);
  const ownPendingHolding = claims ? pin.holdings.find((h) => h.pending && h.userId === claims.sub) : undefined;

  // Title, description, and (front) photo are a deliberate, narrow
  // exception to "no user-typed text or user-uploaded image on a public
  // page" (brief section 7) — the current holder chose to make these
  // public. They're public ONLY for the current open holding, and only the
  // front photo; back/other photos and everything in HoldingNote stay
  // private always.
  const publicTitle = openHolding?.title?.title.trim() || "Untitled Pin";
  const publicDescription = openHolding?.title?.description?.trim() || "";
  const frontPhotoId = openHolding?.photos.find((p) => p.kind === "FRONT")?.id;
  const hasPublicPhoto = !!frontPhotoId;
  // Same per-pin push pin colors as this pin's card on /pins.
  const { photoPinColor, paperPinColor, stickerColor, stickerTilt } = pinCardStyle(parsed.slug);

  // "Part of a series" — a lightweight, public link-through to the
  // decoupled series/checklist catalog (src/app/series), not a field on
  // this pin itself: most pins in a set never get a Wandering Pins sticker
  // at all, so the catalog can't require one. Only the current holder's own
  // linked claim shows here (same "gone once released" precedent as
  // title/description/photo above), even though the underlying claim
  // itself persists on their own /series page regardless of who holds this
  // pin next.
  const seriesLink = openHolding
    ? await prisma.seriesClaim.findFirst({
        where: { linkedPinId: pin.id, userId: openHolding.userId },
        include: { seriesItem: { include: { series: true } } },
      })
    : null;

  // Timeline rows carry an id (holding or check-in) alongside the prose line
  // so an inline "add details" widget can be attached to the right one,
  // gated to its owner — built by hand rather than through
  // toPublicHolding/toPublicCheckIn (which deliberately don't carry an id,
  // being the narrow public-safe boundary), but reading the exact same
  // narrow set of fields those do, never a spread of the raw row.
  const holdingById = new Map(confirmedHoldings.map((h) => [h.id, h]));
  const checkInById = new Map(
    confirmedHoldings.flatMap((h) => h.checkIns.map((c) => [c.id, { checkIn: c, holding: h }] as const))
  );
  const journeyRows = buildJourneyRows(
    confirmedHoldings.map((h) => ({
      id: h.id,
      acquiredAt: h.acquiredAt,
      acquiredVia: h.acquiredVia,
      placeLabel: h.placeLabel,
      holderDisplayName: resolveHolderDisplayName(h.user),
    })),
    confirmedHoldings.flatMap((h) =>
      h.checkIns.map((c) => ({
        id: c.id,
        loggedAt: c.loggedAt,
        placeLabel: c.placeLabel,
        holderDisplayName: resolveHolderDisplayName(h.user),
      }))
    )
  );
  const timelineLines: TimelineLine[] = journeyRows.map((row) => {
    if (row.kind === "holding") {
      const h = holdingById.get(row.id)!;
      const isOwn = claims?.sub === h.userId;
      return {
        key: `holding-${row.id}`,
        date: formatMonthYear(h.acquiredAt),
        kicker: acquisitionKicker(h.acquiredVia),
        place: h.placeLabel,
        holder: resolveHolderDisplayName(h.user),
        star: h.verified ? <VerifiedStar /> : undefined,
        badge:
          !h.verified && isOwn ? <VerifyLocationButton onVerify={verifyHoldingLocation.bind(null, h.id)} /> : undefined,
        action: isOwn ? (
          <InlineHoldingDetails
            holdingId={h.id}
            initialNotes={h.note?.body ?? ""}
            // The FRONT-kind photo (if any) is managed entirely by
            // PinPhotoWidget at the top of the page now — never shown or
            // manageable here, so it can't look like it belongs to this
            // one acquisition event.
            photos={h.photos.filter((p) => p.kind !== "FRONT").map((p) => ({ id: p.id }))}
          />
        ) : undefined,
      };
    }
    const { checkIn, holding } = checkInById.get(row.id)!;
    const isOwn = claims?.sub === holding.userId;
    return {
      key: `checkin-${row.id}`,
      date: formatMonthYear(checkIn.loggedAt),
      kicker: CHECK_IN_KICKER,
      place: checkIn.placeLabel,
      holder: resolveHolderDisplayName(holding.user),
      star: checkIn.verified ? <VerifiedStar /> : undefined,
      badge:
        !checkIn.verified && isOwn ? <VerifyLocationButton onVerify={verifyCheckInLocation.bind(null, checkIn.id)} /> : undefined,
      action: isOwn ? (
        <InlineCheckInDetails
          checkInId={checkIn.id}
          initialNotes={checkIn.note?.body ?? ""}
          photos={checkIn.photos.map((p) => ({ id: p.id }))}
        />
      ) : undefined,
    };
  });

  return (
    <main>
      <PinEditProvider>
        <CorkBoard className="px-4 py-8 sm:py-10">
          <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-10">
            {isCurrentHolder ? (
              <PinTitleWidget holdingId={openHolding!.id} title={publicTitle} />
            ) : (
              <PinNamePill>{publicTitle}</PinNamePill>
            )}

            {/* Photo centered on the board; description note in the lower right;
                the edit sticker beside the photo. Below lg they stack in that
                order: photo, note, then the sticker (it is last in the markup
                too, so keyboard order matches). On lg the explicit columns put
                the sticker in the otherwise-empty first column, and
                minmax(0,...) so a wide note can't squeeze the photo is what
                keeps the photo truly centered. */}
            <div className="grid w-full items-end gap-10 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:gap-6">
              <div className="justify-self-center lg:col-start-2 lg:row-start-1">
                {isCurrentHolder ? (
                  <PinPhotoWidget
                    holdingId={openHolding!.id}
                    slug={parsed.slug}
                    frontPhotoId={frontPhotoId}
                    publicTitle={publicTitle}
                    pinColor={photoPinColor}
                  />
                ) : (
                  hasPublicPhoto && (
                    <PinPhotoFrame pinColor={photoPinColor}>
                      {/* eslint-disable-next-line @next/next/no-img-element -- served through a dedicated public route, not a static asset next/image can optimize */}
                      <img src={`/api/pins/${parsed.slug}/photo`} alt={publicTitle} className="size-56 object-cover" />
                    </PinPhotoFrame>
                  )
                )}
              </div>
              <div className="justify-self-center lg:col-start-3 lg:row-start-1 lg:justify-self-end">
                {isCurrentHolder ? (
                  <PinNote holdingId={openHolding!.id} initialDescription={publicDescription} pinColor={paperPinColor} />
                ) : (
                  publicDescription && (
                    <TornPaper pinColor={paperPinColor}>
                      <p className="whitespace-pre-wrap font-hand text-[22px] leading-7 text-ink">{publicDescription}</p>
                    </TornPaper>
                  )
                )}
              </div>
              {canEdit && (
                <div className="flex justify-start pl-2 lg:col-start-1 lg:row-start-1 lg:justify-end lg:self-center lg:pl-0">
                  <EditPinSticker color={stickerColor} tilt={stickerTilt} />
                </div>
              )}
            </div>
          </div>
        </CorkBoard>

        <div className="mx-auto max-w-2xl px-4 py-10">
          {seriesLink ? (
            <p className="mt-3 text-sm text-neutral-600">
              Part of a series:{" "}
              <Link href={`/series/${seriesLink.seriesItem.series.id}`} className="font-medium text-accent hover:underline">
                {seriesLink.seriesItem.series.name} — {seriesLink.seriesItem.label}
              </Link>
            </p>
          ) : (
            isCurrentHolder && (
              <EditOnly>
                <p className="mt-3 text-sm text-neutral-500">
                  <Link href={`/series?linkPin=${pin.id}`} className="text-accent hover:underline">
                    Add this pin to a series
                  </Link>
                </p>
              </EditOnly>
            )
          )}

          <h2 className="mt-6 text-center font-block text-4xl text-cream [text-shadow:3px_3px_0_#D06A2E] sm:text-5xl">
            Where I&apos;ve Wandered
          </h2>

          <div className="mt-6">
            <MapFrame>
              <PinJourneyMap points={points} />
            </MapFrame>
          </div>

          <PinJourneyTimeline
            lines={timelineLines}
            end={
              isCurrentHolder ? (
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/holdings/${openHolding!.id}#locations`}
                    className="inline-block rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
                  >
                    Log a new location
                  </Link>
                  <Link
                    href={`/trade/${parsed.slug}`}
                    className="inline-block rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover"
                  >
                    Log a trade
                  </Link>
                </div>
              ) : ownPendingHolding ? (
                <p className="text-sm text-neutral-700">
                  ⏳ Your claim on this pin is pending — it&apos;ll join this journey once the current holder releases it.
                </p>
              ) : (
                <div>
                  <p className="text-sm text-neutral-700">Think you have this pin now?</p>
                  <Link
                    href={`/register/${parsed.slug}`}
                    className="mt-2 inline-block rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover"
                  >
                    Claim this pin
                  </Link>
                </div>
              )
            }
          />
        </div>
      </PinEditProvider>
    </main>
  );
}

function UnregisteredPin({ slug }: { slug: string }) {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-semibold">This pin hasn&apos;t been registered yet.</h1>
      <p className="mt-3 text-neutral-700">
        Every Wandering Pins code is printed before anyone has claimed it. If this one is yours,
        register it now to start its journey.
      </p>
      <Link
        href={`/register/${slug}`}
        className="mt-6 inline-block rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover"
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
