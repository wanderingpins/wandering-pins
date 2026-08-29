import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAuthClaims } from "@/lib/auth";
import { BEST_EFFORT_AUTH_TIMEOUT_MS } from "@/lib/with-timeout";
import { resolveHolderDisplayName } from "@/lib/timeline";
import { claimItem, unclaimItem, deleteSeriesItem } from "@/app/series/actions";
import { AddSeriesItemForm } from "@/components/AddSeriesItemForm";

const searchParamsSchema = z.object({ linkPin: z.string().max(64).optional() });

type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function SeriesDetailPage({ params, searchParams }: Props) {
  const { id } = await params;
  const rawParams = await searchParams;
  const parsed = searchParamsSchema.safeParse({ linkPin: firstValue(rawParams.linkPin) });
  const linkPin = parsed.success ? parsed.data.linkPin : undefined;

  const series = await prisma.series.findUnique({
    where: { id },
    include: {
      items: {
        orderBy: [{ position: "asc" }, { label: "asc" }],
        include: {
          claims: { include: { user: { select: { username: true, showNamePublicly: true } } } },
          _count: { select: { claims: true } },
        },
      },
    },
  });
  if (!series) notFound();

  // Best-effort — browsing this page must never stall on a slow auth check
  // (same reasoning as /p/[slug]). Failing open to "logged out" just hides
  // the claim/unclaim controls for this one request.
  const claims = await getAuthClaims(BEST_EFFORT_AUTH_TIMEOUT_MS);
  const viewerId = claims?.sub;

  // Only offer to link linkPin if the viewer actually has some holding on
  // it — cosmetic pre-check for the UI; the action itself re-validates
  // regardless, since this param is user-controlled.
  const canLinkPin =
    viewerId && linkPin ? !!(await prisma.pinHolding.findFirst({ where: { pinId: linkPin, userId: viewerId } })) : false;

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <Link href="/series" className="text-sm text-neutral-500 hover:text-black">
        &larr; All series
      </Link>
      <h1 className="mt-2 text-2xl font-semibold">{series.name}</h1>
      <p className="mt-1 text-sm text-neutral-600">
        Claims are self-reported, like everything else on Wandering Pins — nothing here verifies you
        actually have a piece, it&apos;s just a public checklist for finding trade partners.
      </p>

      <ul className="mt-6 divide-y divide-neutral-200">
        {series.items.map((item) => {
          const ownClaim = viewerId ? item.claims.find((c) => c.userId === viewerId) : undefined;
          const otherClaimants = item.claims
            .filter((c) => c.userId !== viewerId)
            .map((c) => resolveHolderDisplayName(c.user));
          const canDelete = viewerId === item.createdBy && item._count.claims === 0;

          return (
            <li key={item.id} className="flex items-start justify-between gap-3 py-3">
              <div>
                <p className="font-medium">
                  {item.position != null && <span className="text-neutral-500">{item.position}. </span>}
                  {item.label}
                </p>
                <p className="text-sm text-neutral-500">
                  {item.claims.length === 0
                    ? "Nobody's claimed this one yet"
                    : otherClaimants.length > 0
                      ? `Have it: ${otherClaimants.join(", ")}${ownClaim ? " (and you)" : ""}`
                      : ownClaim
                        ? "You have this one"
                        : ""}
                </p>
                {canDelete && (
                  <form action={deleteSeriesItem.bind(null, series.id, item.id)}>
                    <button type="submit" className="text-xs text-neutral-400 hover:text-red-600 hover:underline">
                      Remove (added by you, unclaimed)
                    </button>
                  </form>
                )}
              </div>
              {viewerId ? (
                ownClaim ? (
                  <form action={unclaimItem.bind(null, series.id, item.id)}>
                    <button
                      type="submit"
                      className="whitespace-nowrap rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
                    >
                      ✓ Remove my claim
                    </button>
                  </form>
                ) : (
                  <form action={claimItem.bind(null, series.id, item.id)}>
                    {canLinkPin && <input type="hidden" name="linkedPinId" value={linkPin} />}
                    <button
                      type="submit"
                      className="whitespace-nowrap rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                    >
                      I have this
                    </button>
                  </form>
                )
              ) : (
                <Link href="/sign-in" className="whitespace-nowrap text-xs text-blue-600 hover:underline">
                  Sign in to claim
                </Link>
              )}
            </li>
          );
        })}
      </ul>

      {series.items.length === 0 && <p className="mt-6 text-neutral-600">No pins added yet — be the first.</p>}

      <div className="mt-6">
        <AddSeriesItemForm seriesId={series.id} />
      </div>
    </main>
  );
}

function firstValue(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}
