import Link from "next/link";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAuthClaims } from "@/lib/auth";
import { BEST_EFFORT_AUTH_TIMEOUT_MS } from "@/lib/with-timeout";
import { CreateSeriesForm } from "@/components/CreateSeriesForm";

// Public, no auth required to browse (same spirit as /pins) — crowd-created
// catalog, no admin curation (see the schema comment on Series). Creating a
// series or claiming an item still requires signing in. Signed-in visitors
// also get "My series" on top: every series they've claimed a piece of, with
// how far along they are.
const searchParamsSchema = z.object({
  q: z.string().max(200).optional(),
  linkPin: z.string().max(64).optional(),
});

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function SeriesIndexPage({ searchParams }: Props) {
  const rawParams = await searchParams;
  const parsed = searchParamsSchema.safeParse({
    q: firstValue(rawParams.q),
    linkPin: firstValue(rawParams.linkPin),
  });
  const { q, linkPin } = parsed.success ? parsed.data : {};
  const linkQs = linkPin ? `?linkPin=${encodeURIComponent(linkPin)}` : "";

  const claims = await getAuthClaims(BEST_EFFORT_AUTH_TIMEOUT_MS);
  const viewerId = claims?.sub;

  const [series, mine] = await Promise.all([
    prisma.series.findMany({
      where: q ? { name: { contains: q, mode: "insensitive" } } : undefined,
      include: { _count: { select: { items: true } } },
      orderBy: { name: "asc" },
      take: 100,
    }),
    viewerId
      ? prisma.series.findMany({
          where: { items: { some: { claims: { some: { userId: viewerId } } } } },
          include: {
            _count: { select: { items: true } },
            items: { select: { _count: { select: { claims: { where: { userId: viewerId } } } } } },
          },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
  ]);

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-semibold">Pin series</h1>
      <p className="mt-2 text-sm text-neutral-600">
        Track which pins you have in a set — Disney, blind boxes, anything. Anyone can start a new series or add to an
        existing one; there&apos;s no approval step.
      </p>

      {mine.length > 0 && (
        <section className="mt-8" id="mine">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">My series</h2>
          <ul className="mt-3 flex flex-col gap-3">
            {mine.map((s) => {
              const have = s.items.filter((i) => i._count.claims > 0).length;
              const total = s._count.items;
              const pct = total ? Math.round((have / total) * 100) : 0;
              return (
                <li key={s.id}>
                  <Link
                    href={`/series/${s.id}${linkQs}`}
                    className="block rounded-lg border border-neutral-200 p-3 hover:bg-neutral-50"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-medium">{s.name}</span>
                      <span className="whitespace-nowrap text-sm text-neutral-600">
                        {have} of {total}
                      </span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-200" aria-hidden>
                      <div className="h-full rounded-full bg-gold" style={{ width: `${pct}%` }} />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div className="mt-8">
        <CreateSeriesForm linkPin={linkPin} />
      </div>

      <form className="mt-8" action="/series">
        {linkPin && <input type="hidden" name="linkPin" value={linkPin} />}
        <label htmlFor="q" className="text-xs font-medium text-neutral-600">
          Search existing series
        </label>
        <div className="mt-1 flex gap-2">
          <input
            id="q"
            name="q"
            type="text"
            defaultValue={q ?? ""}
            placeholder="Dungeon Crawler Carl, Epcot Flower & Garden…"
            className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
          />
          <button
            type="submit"
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            Search
          </button>
        </div>
      </form>

      {series.length === 0 ? (
        <p className="mt-8 text-neutral-600">{q ? "No series match that search." : "No series yet — start one above."}</p>
      ) : (
        <ul className="mt-6 divide-y divide-neutral-200">
          {series.map((s) => (
            <li key={s.id} className="flex items-baseline justify-between gap-3 py-3">
              <div>
                <Link href={`/series/${s.id}${linkQs}`} className="font-medium hover:underline">
                  {s.name}
                </Link>
                <p className="text-sm text-neutral-500">
                  {s._count.items} pin{s._count.items === 1 ? "" : "s"} tracked
                </p>
              </div>
              <Link href={`/series/${s.id}?view=all#collectors`} className="whitespace-nowrap text-xs text-accent hover:underline">
                Who collects it
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function firstValue(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}
