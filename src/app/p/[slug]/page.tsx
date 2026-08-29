import Link from "next/link";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { parseSlug } from "@/lib/slug";
import { getAuthClaims } from "@/lib/auth";
import { BEST_EFFORT_AUTH_TIMEOUT_MS } from "@/lib/with-timeout";
import { buildJourneyRows, resolveHolderDisplayName } from "@/lib/timeline";
import { toPublicHolding, toPublicCheckIn } from "@/lib/public-pin";
import { PinJourneyTimeline, type TimelineLine } from "@/components/PinJourneyTimeline";
import { PinJourneyMap } from "@/components/PinJourneyMap";
import { InlineHoldingDetails } from "@/components/InlineHoldingDetails";
import { InlineCheckInDetails } from "@/components/InlineCheckInDetails";
import { PinPhotoWidget } from "@/components/PinPhotoWidget";
import { PinDescriptionWidget } from "@/components/PinDescriptionWidget";
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
        text: row.line,
        badge: (
          <VerifyLocationButton verified={h.verified} isOwn={isOwn} onVerify={verifyHoldingLocation.bind(null, h.id)} />
        ),
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
      text: row.line,
      badge: (
        <VerifyLocationButton
          verified={checkIn.verified}
          isOwn={isOwn}
          onVerify={verifyCheckInLocation.bind(null, checkIn.id)}
        />
      ),
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
    <main className="mx-auto max-w-2xl px-4 py-10">
      <p className="text-lg font-medium text-neutral-800">{publicTitle}</p>
      <h1 className="mt-1 text-2xl font-semibold">Its journey so far</h1>

      {isCurrentHolder ? (
        <PinPhotoWidget
          holdingId={openHolding!.id}
          slug={parsed.slug}
          frontPhotoId={frontPhotoId}
          publicTitle={publicTitle}
        />
      ) : (
        hasPublicPhoto && (
          <div className="mt-4">
            {/* eslint-disable-next-line @next/next/no-img-element -- served through a dedicated public route, not a static asset next/image can optimize */}
            <img
              src={`/api/pins/${parsed.slug}/photo`}
              alt={publicTitle}
              className="aspect-square w-full max-w-xs rounded-lg border border-neutral-200 object-cover"
            />
          </div>
        )
      )}

      {isCurrentHolder ? (
        <PinDescriptionWidget holdingId={openHolding!.id} initialDescription={publicDescription} />
      ) : (
        publicDescription && <p className="mt-4 whitespace-pre-wrap text-sm text-neutral-800">{publicDescription}</p>
      )}

      {seriesLink ? (
        <p className="mt-3 text-sm text-neutral-600">
          Part of a series:{" "}
          <Link href={`/series/${seriesLink.seriesItem.series.id}`} className="font-medium text-blue-600 hover:underline">
            {seriesLink.seriesItem.series.name} — {seriesLink.seriesItem.label}
          </Link>
        </p>
      ) : (
        isCurrentHolder && (
          <p className="mt-3 text-sm text-neutral-500">
            <Link href={`/series?linkPin=${pin.id}`} className="text-blue-600 hover:underline">
              Add this pin to a series
            </Link>
          </p>
        )
      )}

      <div className="mt-6">
        <PinJourneyMap points={points} />
      </div>

      <div className="mt-8">
        <PinJourneyTimeline lines={timelineLines} />
      </div>

      <div className="mt-10 rounded-lg border border-neutral-200 p-4">
        {isCurrentHolder ? (
          <>
            <p className="text-sm text-neutral-700">This pin is currently in your hands.</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Link
                href={`/holdings/${openHolding!.id}#locations`}
                className="inline-block rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
              >
                Log a new location
              </Link>
              <Link
                href={`/trade/${parsed.slug}`}
                className="inline-block rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Log a trade
              </Link>
            </div>
          </>
        ) : ownPendingHolding ? (
          <p className="text-sm text-neutral-700">
            ⏳ Your claim on this pin is pending — it&apos;ll join this journey once the current holder releases it.
          </p>
        ) : (
          <>
            <p className="text-sm text-neutral-700">Think you have this pin now?</p>
            <Link
              href={`/register/${parsed.slug}`}
              className="mt-2 inline-block rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Claim this pin
            </Link>
          </>
        )}
      </div>
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
        className="mt-6 inline-block rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
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
