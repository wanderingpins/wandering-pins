import Link from "next/link";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { parseSlug } from "@/lib/slug";
import { getAuthClaims } from "@/lib/auth";
import { buildTimeline, formatMonthYear } from "@/lib/timeline";
import { toPublicHolding } from "@/lib/public-pin";
import { PinJourneyTimeline } from "@/components/PinJourneyTimeline";
import { PinJourneyMap } from "@/components/PinJourneyMap";

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
        // title/photos/note are loaded here for convenience but never touch
        // toPublicHolding below — see the dedicated public-title/photo
        // section further down, and the private "Your notes" section, for
        // the only two places these leave this file.
        include: { user: true, title: true, photos: true, note: true },
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

  const holdings = pin.holdings.map(toPublicHolding);
  const lines = buildTimeline(holdings);
  const points = holdings.map((h) => ({ lat: h.lat, lng: h.lng, label: h.placeLabel }));

  // At most one open holding per pin (restored partial unique index —
  // release is atomic and one-sided, brief section 6.4, so there's never an
  // overlap, only a gap between someone releasing and someone else claiming).
  const openHolding = pin.holdings.find((h) => h.releasedAt === null);
  const claims = await getAuthClaims();
  const isCurrentHolder = !!claims && claims.sub === openHolding?.userId;

  // Title and (front) photo are a deliberate, narrow exception to "no
  // user-typed text or user-uploaded image on a public page" (brief section
  // 7) — the current holder chose to make these two fields public. They're
  // public ONLY for the current open holding, and only the front photo;
  // back/other photos and everything in HoldingNote stay private always.
  const publicTitle = openHolding?.title?.title.trim() || "Untitled Pin";
  const hasPublicPhoto = !!openHolding?.photos.some((p) => p.kind === "FRONT");

  // Notes are private to whoever wrote them, permanently — a holding row
  // (and its note) is never deleted on release, so this still finds a past
  // holder's own notes on a pin they no longer have.
  const ownNotedHoldings = claims
    ? pin.holdings.filter((h) => h.userId === claims.sub && h.note?.body)
    : [];

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <p className="text-sm text-neutral-500">Pin {parsed.slug}</p>
      <p className="mt-1 text-lg font-medium text-neutral-800">{publicTitle}</p>
      <h1 className="mt-1 text-2xl font-semibold">Its journey so far</h1>

      {hasPublicPhoto && (
        <div className="mt-4">
          {/* eslint-disable-next-line @next/next/no-img-element -- served through a dedicated public route, not a static asset next/image can optimize */}
          <img
            src={`/api/pins/${parsed.slug}/photo`}
            alt={publicTitle}
            className="aspect-square w-full max-w-xs rounded-lg border border-neutral-200 object-cover"
          />
        </div>
      )}

      <div className="mt-6">
        <PinJourneyMap points={points} />
      </div>

      <div className="mt-8">
        <PinJourneyTimeline lines={lines} />
      </div>

      {ownNotedHoldings.length > 0 && (
        <div className="mt-8">
          <p className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-600">
            🔒 Only you can see this
          </p>
          <h2 className="mt-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">Your notes</h2>
          <ul className="mt-3 space-y-4">
            {ownNotedHoldings.map((h) => (
              <li key={h.id} className="rounded-lg border border-neutral-200 p-4">
                <p className="text-xs text-neutral-500">
                  {formatMonthYear(h.acquiredAt)} – {h.releasedAt ? formatMonthYear(h.releasedAt) : "now"}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-neutral-800">{h.note!.body}</p>
                <Link href={`/holdings/${h.id}`} className="mt-2 inline-block text-sm text-blue-600 hover:underline">
                  Edit
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-10 rounded-lg border border-neutral-200 p-4">
        {isCurrentHolder ? (
          <>
            <p className="text-sm text-neutral-700">This pin is currently in your hands.</p>
            <Link
              href={`/trade/${parsed.slug}`}
              className="mt-2 inline-block rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Log a trade
            </Link>
          </>
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
      <p className="text-sm text-neutral-500">Pin {slug}</p>
      <h1 className="mt-1 text-2xl font-semibold">This pin hasn&apos;t been registered yet.</h1>
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
