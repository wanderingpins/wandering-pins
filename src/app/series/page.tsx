import Link from "next/link";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { CreateSeriesForm } from "@/components/CreateSeriesForm";

// Public, no auth required to browse (same spirit as /pins) — crowd-created
// catalog, no admin curation (see the schema comment on Series). Creating a
// series or claiming an item still requires signing in.
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

  const series = await prisma.series.findMany({
    where: q ? { name: { contains: q, mode: "insensitive" } } : undefined,
    include: { _count: { select: { items: true } } },
    orderBy: { name: "asc" },
    take: 100,
  });

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-semibold">Pin series</h1>
      <p className="mt-2 text-sm text-neutral-600">
        Track which pins you have in a set — Disney, blind boxes, anything. Anyone can start a new
        series or add to an existing one; there&apos;s no approval step.
      </p>

      <div className="mt-6">
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
        <p className="mt-8 text-neutral-600">
          {q ? "No series match that search." : "No series yet — start one above."}
        </p>
      ) : (
        <ul className="mt-6 divide-y divide-neutral-200">
          {series.map((s) => (
            <li key={s.id} className="py-3">
              <Link href={`/series/${s.id}${linkPin ? `?linkPin=${encodeURIComponent(linkPin)}` : ""}`} className="font-medium hover:underline">
                {s.name}
              </Link>
              <p className="text-sm text-neutral-500">
                {s._count.items} pin{s._count.items === 1 ? "" : "s"} tracked
              </p>
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
