import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ConfirmButton } from "@/components/ConfirmButton";
import {
  adminClearPinText,
  adminDeletePinPhoto,
  adminDeleteSeries,
  adminDeleteSeriesItem,
  adminRemoveSeriesImage,
  adminRenameSeries,
} from "@/app/admin/actions";

// The /admin page's sections. Server components; the page itself does the
// requireAdmin check before rendering any of them, and every action re-checks.

const DANGER = "rounded-md border border-red-600/60 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-600 hover:text-white";

// Every pin's current public face: photo, name, description, newest first.
export async function PhotosTab() {
  const holdings = await prisma.pinHolding.findMany({
    where: { releasedAt: null, pending: false },
    orderBy: { acquiredAt: "desc" },
    take: 200,
    select: {
      id: true,
      pin: { select: { number: true } },
      user: { select: { username: true, email: true } },
      title: { select: { title: true, description: true } },
      photos: { where: { kind: "FRONT" }, select: { id: true }, take: 1 },
    },
  });

  return (
    <section className="mt-6">
      <p className="text-sm text-neutral-600">
        What each pin shows the public right now (the current holder&apos;s photo, name and description). Newest first,
        up to 200.
      </p>
      <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {holdings.map((h) => {
          const photo = h.photos[0];
          const title = h.title?.title.trim();
          const description = h.title?.description?.trim();
          return (
            <li key={h.id} className="flex gap-3 rounded-lg border border-neutral-200 p-3">
              {photo ? (
                // eslint-disable-next-line @next/next/no-img-element -- the same public route /pins uses
                <img src={`/api/pins/${h.pin.number}/photo`} alt="" className="size-24 flex-shrink-0 rounded object-cover" />
              ) : (
                <div className="flex size-24 flex-shrink-0 items-center justify-center rounded bg-neutral-100 text-xs text-neutral-500">
                  No photo
                </div>
              )}
              <div className="flex min-w-0 flex-col gap-1">
                <Link href={`/p/${h.pin.number}`} className="truncate font-medium hover:underline">
                  #{h.pin.number} {title || "Untitled Pin"}
                </Link>
                {description && <p className="line-clamp-2 text-xs text-neutral-600">{description}</p>}
                <p className="truncate text-xs text-neutral-500">
                  {h.user.username ?? "(no username)"} · {h.user.email}
                </p>
                <div className="mt-auto flex flex-wrap gap-2 pt-1">
                  {photo && (
                    <form action={adminDeletePinPhoto.bind(null, photo.id)}>
                      <ConfirmButton message={`Delete the public photo on pin #${h.pin.number}? This can't be undone.`} className={DANGER}>
                        Delete photo
                      </ConfirmButton>
                    </form>
                  )}
                  {(title || description) && (
                    <form action={adminClearPinText.bind(null, h.id)}>
                      <ConfirmButton message={`Clear the name and description on pin #${h.pin.number}?`} className={DANGER}>
                        Clear name &amp; text
                      </ConfirmButton>
                    </form>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export async function SeriesTab() {
  const [allSeries, images] = await Promise.all([
    prisma.series.findMany({
      orderBy: { createdAt: "desc" },
      include: { creator: { select: { username: true } }, _count: { select: { items: true } } },
    }),
    prisma.seriesItem.findMany({
      where: { imagePath: { not: null } },
      orderBy: { imageAddedAt: "desc" },
      take: 200,
      include: { series: { select: { name: true } } },
    }),
  ]);
  const uploaderIds = [...new Set(images.map((i) => i.imageBy).filter((id): id is string => !!id))];
  const uploaders = new Map(
    (await prisma.user.findMany({ where: { id: { in: uploaderIds } }, select: { id: true, username: true, email: true } })).map(
      (u) => [u.id, u]
    )
  );

  return (
    <section className="mt-6 flex flex-col gap-10">
      <div>
        <h2 className="text-lg font-semibold">Pictures added to series pins</h2>
        <p className="text-sm text-neutral-600">Newest first. Anyone signed in can add one to a pin that has none.</p>
        {images.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-500">None yet.</p>
        ) : (
          <ul className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {images.map((i) => {
              const u = i.imageBy ? uploaders.get(i.imageBy) : undefined;
              return (
                <li key={i.id} className="flex flex-col gap-1 text-xs">
                  {/* eslint-disable-next-line @next/next/no-img-element -- public series image route */}
                  <img
                    src={`/api/series-items/${i.id}/image?v=${i.imageAddedAt?.getTime() ?? 0}`}
                    alt=""
                    className="aspect-square w-full rounded object-cover"
                  />
                  <Link href={`/series/${i.seriesId}?view=all`} className="truncate font-medium hover:underline">
                    {i.series.name}: {i.label}
                  </Link>
                  <span className="truncate text-neutral-500">by {u ? `${u.username ?? "?"} · ${u.email}` : "unknown"}</span>
                  <form action={adminRemoveSeriesImage.bind(null, i.id)}>
                    <ConfirmButton message="Remove this picture?" className={DANGER}>
                      Remove picture
                    </ConfirmButton>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div>
        <h2 className="text-lg font-semibold">All series</h2>
        <ul className="mt-3 divide-y divide-neutral-200">
          {allSeries.map((s) => (
            <li key={s.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <Link href={`/series/${s.id}?view=all`} className="font-medium hover:underline">
                  {s.name}
                </Link>
                <p className="text-xs text-neutral-500">
                  {s._count.items} pins · started by {s.creator.username ?? "?"} on {s.createdAt.toLocaleDateString("en-US")}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <form action={adminRenameSeries.bind(null, s.id)} className="flex gap-1">
                  <input
                    name="name"
                    defaultValue={s.name}
                    maxLength={100}
                    aria-label={`Rename ${s.name}`}
                    className="w-48 rounded-md border border-neutral-300 px-2 py-1 text-xs"
                  />
                  <button type="submit" className="rounded-md border border-neutral-300 px-2 py-1 text-xs hover:bg-neutral-50">
                    Rename
                  </button>
                </form>
                <form action={adminDeleteSeries.bind(null, s.id)}>
                  <ConfirmButton
                    message={`Delete "${s.name}" with all ${s._count.items} of its pins and everyone's claims? This can't be undone.`}
                    className={DANGER}
                  >
                    Delete series
                  </ConfirmButton>
                </form>
              </div>
            </li>
          ))}
        </ul>
        <SeriesItemsAdmin />
      </div>
    </section>
  );
}

// Individual series pins, newest first — for removing one bad entry without
// deleting the whole series.
async function SeriesItemsAdmin() {
  const items = await prisma.seriesItem.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { series: { select: { name: true } }, creator: { select: { username: true } }, _count: { select: { claims: true } } },
  });
  if (items.length === 0) return null;
  return (
    <details className="mt-6 rounded-lg border border-neutral-200 p-3">
      <summary className="cursor-pointer text-sm font-medium">Newest series pins ({items.length})</summary>
      <ul className="mt-3 divide-y divide-neutral-200">
        {items.map((i) => (
          <li key={i.id} className="flex items-center justify-between gap-3 py-2 text-sm">
            <span className="min-w-0 truncate">
              {i.series.name}: <strong>{i.label}</strong>{" "}
              <span className="text-xs text-neutral-500">
                by {i.creator.username ?? "?"} · {i._count.claims} claim{i._count.claims === 1 ? "" : "s"}
              </span>
            </span>
            <form action={adminDeleteSeriesItem.bind(null, i.id)}>
              <ConfirmButton
                message={`Delete "${i.label}" from ${i.series.name}${i._count.claims ? ` (and ${i._count.claims} claim(s) on it)` : ""}?`}
                className={DANGER}
              >
                Delete
              </ConfirmButton>
            </form>
          </li>
        ))}
      </ul>
    </details>
  );
}

export async function UsersTab({ q }: { q?: string }) {
  const where = q
    ? { OR: [{ username: { contains: q, mode: "insensitive" as const } }, { email: { contains: q, mode: "insensitive" as const } }] }
    : undefined;
  const users = await prisma.user.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      username: true,
      email: true,
      createdAt: true,
      showNamePublicly: true,
      _count: { select: { holdings: true, seriesClaims: true } },
    },
  });

  return (
    <section className="mt-6">
      <form action="/admin" className="flex gap-2">
        <input type="hidden" name="tab" value="users" />
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Username or email"
          className="w-64 rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
        />
        <button type="submit" className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50">
          Search
        </button>
      </form>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[36rem] text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="py-2 pr-3">Username</th>
              <th className="py-2 pr-3">Email</th>
              <th className="py-2 pr-3">Joined</th>
              <th className="py-2 pr-3">Pins held</th>
              <th className="py-2">Series claims</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200">
            {users.map((u) => (
              <tr key={u.id}>
                <td className="py-2 pr-3">
                  {u.username ?? <span className="text-neutral-500">(not onboarded)</span>}
                  {!u.showNamePublicly && <span className="ml-1 text-xs text-neutral-500">(hidden)</span>}
                </td>
                <td className="py-2 pr-3 text-neutral-600">{u.email}</td>
                <td className="py-2 pr-3 text-neutral-600">{u.createdAt.toLocaleDateString("en-US")}</td>
                <td className="py-2 pr-3">{u._count.holdings}</td>
                <td className="py-2">{u._count.seriesClaims}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-neutral-500">
        Newest first, up to 200. Deleting or banning an account isn&apos;t here yet — that still happens in the Supabase
        dashboard (Authentication → Users).
      </p>
    </section>
  );
}

