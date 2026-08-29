import Link from "next/link";
import { z } from "zod";
import { loadDirectoryPage, type DirectorySort } from "@/lib/pin-directory";

// Public, no authentication (brief section 6.1's spirit extended to a
// browsable index rather than one pin at a time) — rate-limited the same
// way /p/[slug] is (see src/proxy.ts), and arguably more important here:
// one request against this page returns a summary of every registered pin
// instead of just one, making it a more efficient scrape target than the
// per-pin page it complements. Paginated (see pin-directory.ts) so the
// rendered HTML itself never carries the whole table either.
const searchParamsSchema = z.object({
  q: z.string().max(200).optional(),
  sort: z.enum(["mostTraveled", "newest", "title"]).optional(),
  page: z.coerce.number().int().min(1).optional(),
});

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function PinsDirectoryPage({ searchParams }: Props) {
  const rawParams = await searchParams;
  const parsed = searchParamsSchema.safeParse({
    q: firstValue(rawParams.q),
    sort: firstValue(rawParams.sort),
    page: firstValue(rawParams.page),
  });
  const { q, sort, page } = parsed.success ? parsed.data : {};

  const { pins, page: currentPage, pageCount, total } = await loadDirectoryPage({ search: q, sort, page });

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-semibold">Browse pins</h1>
      <p className="mt-2 text-sm text-neutral-600">
        Every registered pin with a public journey — {total} total. Looking for set/series
        checklists (Disney, blind boxes, anything) instead?{" "}
        <Link href="/series" className="text-blue-600 hover:underline">
          Browse series
        </Link>
        .
      </p>

      <form className="mt-6 flex flex-wrap items-end gap-3" action="/pins">
        <div className="flex flex-col gap-1">
          <label htmlFor="q" className="text-xs font-medium text-neutral-600">
            Search
          </label>
          <input
            id="q"
            name="q"
            type="text"
            defaultValue={q ?? ""}
            placeholder="Title, description, collector…"
            className="w-64 rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="sort" className="text-xs font-medium text-neutral-600">
            Sort by
          </label>
          <select
            id="sort"
            name="sort"
            defaultValue={sort ?? "mostTraveled"}
            className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
          >
            <option value="mostTraveled">Most traveled</option>
            <option value="newest">Newest</option>
            <option value="title">Title (A–Z)</option>
          </select>
        </div>
        <button
          type="submit"
          className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          Apply
        </button>
      </form>

      {pins.length === 0 ? (
        <p className="mt-8 text-neutral-600">No pins match yet.</p>
      ) : (
        <ul className="mt-6 divide-y divide-neutral-200">
          {pins.map((pin) => (
            <li key={pin.slug} className="flex items-start gap-3 py-4">
              {pin.hasPhoto ? (
                // eslint-disable-next-line @next/next/no-img-element -- served through the same public per-pin photo route as /p/[slug]
                <img
                  src={`/api/pins/${pin.slug}/photo`}
                  alt={pin.title}
                  className="h-16 w-16 flex-shrink-0 rounded-md object-cover"
                />
              ) : (
                <div className="h-16 w-16 flex-shrink-0 rounded-md bg-neutral-100" aria-hidden />
              )}
              <div className="flex flex-1 flex-col gap-0.5">
                <Link href={`/p/${pin.slug}`} className="font-medium hover:underline">
                  {pin.title}
                </Link>
                {pin.description && <p className="line-clamp-2 text-sm text-neutral-600">{pin.description}</p>}
                <p className="text-sm text-neutral-600">
                  {pin.holderDisplayName ? `Currently with ${pin.holderDisplayName}` : "Not currently held by anyone"}
                  {" · "}
                  {pin.verifiedCount} verified location{pin.verifiedCount === 1 ? "" : "s"}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {pageCount > 1 && (
        <div className="mt-6 flex items-center justify-between text-sm">
          <PageLink params={{ q, sort }} page={currentPage - 1} disabled={currentPage <= 1}>
            &larr; Previous
          </PageLink>
          <span className="text-neutral-500">
            Page {currentPage} of {pageCount}
          </span>
          <PageLink params={{ q, sort }} page={currentPage + 1} disabled={currentPage >= pageCount}>
            Next &rarr;
          </PageLink>
        </div>
      )}
    </main>
  );
}

function firstValue(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function PageLink({
  params,
  page,
  disabled,
  children,
}: {
  params: { q?: string; sort?: DirectorySort };
  page: number;
  disabled: boolean;
  children: React.ReactNode;
}) {
  if (disabled) {
    return <span className="text-neutral-300">{children}</span>;
  }
  const qs = new URLSearchParams();
  if (params.q) qs.set("q", params.q);
  if (params.sort) qs.set("sort", params.sort);
  qs.set("page", String(page));
  return (
    <Link href={`/pins?${qs.toString()}`} className="text-blue-600 hover:underline">
      {children}
    </Link>
  );
}
