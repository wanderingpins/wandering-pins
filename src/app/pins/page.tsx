import Link from "next/link";
import { z } from "zod";
import { CorkBoard } from "@/components/CorkBoard";
import { PinCard } from "@/components/PinCard";
import { loadDirectoryPage, type DirectorySort } from "@/lib/pin-directory";

type View = "cork" | "list";

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
  // Cork is the default, so only "list" ever appears in a URL.
  view: z.enum(["cork", "list"]).optional(),
});

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function PinsDirectoryPage({ searchParams }: Props) {
  const rawParams = await searchParams;
  const parsed = searchParamsSchema.safeParse({
    q: firstValue(rawParams.q),
    sort: firstValue(rawParams.sort),
    page: firstValue(rawParams.page),
    view: firstValue(rawParams.view),
  });
  const { q, sort, page, view: rawView } = parsed.success ? parsed.data : {};
  const view = rawView ?? "cork";

  const { pins, page: currentPage, pageCount, total } = await loadDirectoryPage({ search: q, sort, page });

  return (
    <main>
      <div className="mx-auto max-w-3xl px-4 pt-10">
        <h1 className="text-2xl font-semibold">Browse pins</h1>
        <p className="mt-2 text-sm text-neutral-600">
          Every registered pin with a public journey — {total} total. Looking for set/series
          checklists (Disney, blind boxes, anything) instead?{" "}
          <Link href="/series" className="text-accent hover:underline">
            Browse series
          </Link>
          .
        </p>

        <form className="mt-6 flex flex-wrap items-end gap-3" action="/pins">
          {view === "list" && <input type="hidden" name="view" value="list" />}
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
            className="rounded-md bg-brand px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-hover"
          >
            Apply
          </button>
          <ViewToggle view={view} params={{ q, sort }} />
        </form>
      </div>

      {pins.length === 0 ? (
        <div className="mx-auto max-w-3xl px-4">
          <p className="mt-8 text-neutral-600">No pins match yet.</p>
        </div>
      ) : view === "list" ? (
        <div className="mx-auto max-w-3xl px-4">
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
        </div>
      ) : (
        // Cork is the default view: a board of small pin scenes, as many side
        // by side as fit (one column on a phone).
        <CorkBoard className="mt-6 px-4 py-10 sm:px-8">
          <ul className="mx-auto grid max-w-6xl grid-cols-1 gap-x-6 gap-y-12 sm:grid-cols-[repeat(auto-fill,minmax(300px,1fr))]">
            {pins.map((pin) => (
              <li key={pin.slug}>
                <PinCard pin={pin} />
              </li>
            ))}
          </ul>
        </CorkBoard>
      )}

      {pageCount > 1 && (
        <div className="mx-auto max-w-3xl px-4 pb-10">
          <div className="mt-6 flex items-center justify-between text-sm">
            <PageLink params={{ q, sort, view }} page={currentPage - 1} disabled={currentPage <= 1}>
              &larr; Previous
            </PageLink>
            <span className="text-neutral-500">
              Page {currentPage} of {pageCount}
            </span>
            <PageLink params={{ q, sort, view }} page={currentPage + 1} disabled={currentPage >= pageCount}>
              Next &rarr;
            </PageLink>
          </div>
        </div>
      )}
    </main>
  );
}

function firstValue(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

// Cork board or plain list. Switching keeps the search and sort, and drops the
// page number (the two views paginate the same way, but landing on page 1 is
// the less surprising reset).
function ViewToggle({ view, params }: { view: View; params: { q?: string; sort?: DirectorySort } }) {
  function hrefFor(target: View) {
    const qs = new URLSearchParams();
    if (params.q) qs.set("q", params.q);
    if (params.sort) qs.set("sort", params.sort);
    if (target === "list") qs.set("view", "list");
    const query = qs.toString();
    return query ? `/pins?${query}` : "/pins";
  }

  function tab(target: View, label: string) {
    return (
      <Link
        href={hrefFor(target)}
        aria-current={view === target ? "page" : undefined}
        className={`px-3 py-1.5 ${view === target ? "bg-brand text-white" : "text-neutral-700 hover:bg-neutral-50"}`}
      >
        {label}
      </Link>
    );
  }

  return (
    <div role="group" aria-label="View" className="ml-auto flex overflow-hidden rounded-md border border-neutral-300 text-sm font-medium">
      {tab("cork", "Cork board")}
      {tab("list", "List")}
    </div>
  );
}

function PageLink({
  params,
  page,
  disabled,
  children,
}: {
  params: { q?: string; sort?: DirectorySort; view?: View };
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
  if (params.view === "list") qs.set("view", "list");
  qs.set("page", String(page));
  return (
    <Link href={`/pins?${qs.toString()}`} className="text-accent hover:underline">
      {children}
    </Link>
  );
}
