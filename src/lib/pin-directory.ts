import { prisma } from "@/lib/prisma";
import { resolveHolderDisplayName } from "@/lib/timeline";

// One row in the public pins database (/pins) — same structured-only
// discipline as PublicHolding in public-pin.ts: title/description/photo are
// exposed here for exactly the same reason they're exposed on /p/[slug]
// (brief section 7's narrow, explicit exception), never anything private
// (notes, non-front photos, check-in content).
export type DirectoryPin = {
  slug: string;
  title: string;
  description: string;
  hasPhoto: boolean;
  holderDisplayName: string | null;
  verifiedCount: number;
  registeredAt: Date;
};

export type DirectorySort = "mostTraveled" | "newest" | "title";

const PAGE_SIZE = 25;

// Loads every registered pin's public-facing summary in one query rather
// than pushing search/sort/pagination into SQL. Simple, and matches this
// codebase's existing style (my-pins does an equivalent whole-set join in
// JS rather than raw SQL) — but it does mean every request re-scans the
// full registered-pin table. Fine at hundreds or low thousands of pins
// (this app's realistic ceiling, bounded by physical stickers printed);
// revisit with a real DB-side query if that ever stops being true.
async function loadAllDirectoryPins(): Promise<DirectoryPin[]> {
  const pins = await prisma.pin.findMany({
    where: { status: "REGISTERED" },
    select: {
      slug: true,
      registeredAt: true,
      holdings: {
        where: { pending: false },
        select: {
          releasedAt: true,
          verified: true,
          user: { select: { username: true, showNamePublicly: true } },
          title: { select: { title: true, description: true } },
          photos: { where: { kind: "FRONT" }, select: { id: true }, take: 1 },
          checkIns: { select: { verified: true } },
        },
      },
    },
  });

  return pins.map((pin) => {
    const openHolding = pin.holdings.find((h) => h.releasedAt === null);
    const verifiedCount = pin.holdings.reduce(
      (sum, h) => sum + (h.verified ? 1 : 0) + h.checkIns.filter((c) => c.verified).length,
      0
    );
    return {
      slug: pin.slug,
      title: openHolding?.title?.title.trim() || "Untitled Pin",
      description: openHolding?.title?.description?.trim() || "",
      hasPhoto: !!openHolding?.photos[0],
      holderDisplayName: openHolding ? resolveHolderDisplayName(openHolding.user) : null,
      verifiedCount,
      registeredAt: pin.registeredAt!,
    };
  });
}

function matchesSearch(pin: DirectoryPin, needle: string): boolean {
  const haystack = [pin.title, pin.description, pin.holderDisplayName ?? ""].join(" ").toLowerCase();
  return haystack.includes(needle);
}

// Pure — sort/filter/paginate a set already loaded, so the logic here is
// unit-testable without a database.
export function filterSortPaginate(
  pins: DirectoryPin[],
  opts: { search?: string; sort?: DirectorySort; page?: number }
): { pins: DirectoryPin[]; page: number; pageCount: number; total: number } {
  let result = pins;

  const search = opts.search?.trim().toLowerCase();
  if (search) {
    result = result.filter((p) => matchesSearch(p, search));
  }

  const sort = opts.sort ?? "mostTraveled";
  const sorted = [...result].sort((a, b) => {
    if (sort === "title") return a.title.localeCompare(b.title);
    if (sort === "newest") return b.registeredAt.getTime() - a.registeredAt.getTime();
    // mostTraveled: verified-location count first, ties broken newest-first.
    if (b.verifiedCount !== a.verifiedCount) return b.verifiedCount - a.verifiedCount;
    return b.registeredAt.getTime() - a.registeredAt.getTime();
  });

  const total = sorted.length;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(Math.max(1, opts.page ?? 1), pageCount);
  const start = (page - 1) * PAGE_SIZE;

  return { pins: sorted.slice(start, start + PAGE_SIZE), page, pageCount, total };
}

export async function loadDirectoryPage(opts: { search?: string; sort?: DirectorySort; page?: number }) {
  const all = await loadAllDirectoryPins();
  return filterSortPaginate(all, opts);
}
