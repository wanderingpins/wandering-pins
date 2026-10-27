import Link from "next/link";

export type View = "cork" | "list";

// Cork board or plain list, shared by /pins and /my-pins. Cork is the default,
// so only "list" ever appears in a URL. Switching keeps the other query params
// the page passes in (search, sort) and drops the page number — the two views
// paginate the same way, but landing on page 1 is the less surprising reset.
export function ViewToggle({
  view,
  basePath,
  params = {},
}: {
  view: View;
  basePath: string;
  params?: Record<string, string | undefined>;
}) {
  function hrefFor(target: View) {
    const qs = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value) qs.set(key, value);
    }
    if (target === "list") qs.set("view", "list");
    const query = qs.toString();
    return query ? `${basePath}?${query}` : basePath;
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
