import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { PhotosTab, SeriesTab, UsersTab } from "@/app/admin/tabs";

export const metadata: Metadata = { title: "Admin · Wandering Pins", robots: { index: false } };

// Site admin: who's signed up, and moderation of everything PUBLIC (pin
// photos, pin names/descriptions, the series catalog and its pictures).
// Gated by ADMIN_EMAILS (see isAdminEmail); anyone else gets a 404. Private
// notes and private photos are deliberately not shown here — the site
// promises they're visible only to their owner.

const TABS = [
  { key: "photos", label: "Pin photos & names" },
  { key: "series", label: "Series" },
  { key: "users", label: "Users" },
] as const;
type Tab = (typeof TABS)[number]["key"];

const searchParamsSchema = z.object({
  tab: z.enum(["photos", "series", "users"]).optional(),
  q: z.string().max(100).optional(),
});

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function AdminPage({ searchParams }: Props) {
  await requireAdmin();
  const raw = await searchParams;
  const parsed = searchParamsSchema.safeParse({ tab: firstValue(raw.tab), q: firstValue(raw.q) });
  const tab: Tab = (parsed.success && parsed.data.tab) || "photos";
  const q = parsed.success ? parsed.data.q : undefined;

  const [users, pins, stickersAttached, stickersTotal, series, seriesImages] = await Promise.all([
    prisma.user.count(),
    prisma.pin.count(),
    prisma.sticker.count({ where: { pinId: { not: null } } }),
    prisma.sticker.count(),
    prisma.series.count(),
    prisma.seriesItem.count({ where: { imagePath: { not: null } } }),
  ]);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10">
      <h1 className="text-2xl font-semibold">Admin</h1>

      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat label="Users" value={users} />
        <Stat label="Pins" value={pins} />
        <Stat label="Stickers used" value={`${stickersAttached} / ${stickersTotal}`} />
        <Stat label="Series" value={series} />
        <Stat label="Series pictures" value={seriesImages} />
      </dl>

      <nav className="mt-6 flex flex-wrap gap-2 border-b border-neutral-200 pb-3">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/admin?tab=${t.key}`}
            aria-current={tab === t.key ? "page" : undefined}
            className={`rounded-full px-4 py-2 text-sm font-medium ${
              tab === t.key ? "bg-brand text-white" : "text-neutral-700 hover:bg-neutral-100"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === "photos" && <PhotosTab />}
      {tab === "series" && <SeriesTab />}
      {tab === "users" && <UsersTab q={q} />}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-neutral-200 p-3">
      <dt className="text-xs uppercase tracking-wide text-neutral-500">{label}</dt>
      <dd className="mt-1 text-xl font-semibold">{value}</dd>
    </div>
  );
}

function firstValue(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}
