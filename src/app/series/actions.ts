"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAppUser } from "@/lib/auth";
import { normalizeSeriesKey, MAX_SERIES_NAME_LENGTH, MAX_SERIES_ITEM_LABEL_LENGTH } from "@/lib/series";

export type ActionState = { status: "idle" | "ok" | "error"; message?: string };

// Crowd-created catalog with no admin queue (see the schema comment on
// Series) — the one guard against high-volume spam is this per-user
// throttle, checked before every create. Generous enough for a real
// collector entering a whole blind-box set in one sitting, not for a bot.
const CREATION_WINDOW_MS = 60 * 60 * 1000;
const MAX_CREATIONS_PER_WINDOW = 30;

async function assertNotOverCreationLimit(userId: string): Promise<string | null> {
  const since = new Date(Date.now() - CREATION_WINDOW_MS);
  const [seriesCount, itemCount] = await Promise.all([
    prisma.series.count({ where: { createdBy: userId, createdAt: { gt: since } } }),
    prisma.seriesItem.count({ where: { createdBy: userId, createdAt: { gt: since } } }),
  ]);
  if (seriesCount + itemCount >= MAX_CREATIONS_PER_WINDOW) {
    return "You've created a lot of new entries recently — please slow down and try again in a bit.";
  }
  return null;
}

// Find-or-create by normalised key (see src/lib/series.ts) — creating a
// series that already exists (by any casing/whitespace) just lands you on
// the existing one instead of forking the catalog. `linkPin` is carried
// through as a query param so a user arriving from "Add this pin to a
// series" on /p/[slug] stays on that same errand across the redirect.
export async function findOrCreateSeries(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireAppUser("/series");

  const name = (formData.get("name") as string | null)?.trim() ?? "";
  const linkPin = (formData.get("linkPin") as string | null)?.trim() ?? "";
  if (!name) {
    return { status: "error", message: "Enter a series name." };
  }
  if (name.length > MAX_SERIES_NAME_LENGTH) {
    return { status: "error", message: `Keep it under ${MAX_SERIES_NAME_LENGTH} characters.` };
  }

  const nameKey = normalizeSeriesKey(name);
  const existing = await prisma.series.findUnique({ where: { nameKey } });
  if (existing) {
    redirect(seriesUrl(existing.id, linkPin));
  }

  const limitMessage = await assertNotOverCreationLimit(user.id);
  if (limitMessage) {
    return { status: "error", message: limitMessage };
  }

  const created = await prisma.series.create({ data: { name, nameKey, createdBy: user.id } });
  redirect(seriesUrl(created.id, linkPin));
}

// Same find-or-create discipline as above, scoped within one series —
// re-adding a slot someone else already entered just returns it rather than
// duplicating it.
export async function addSeriesItem(seriesId: string, _prevState: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireAppUser(`/series/${seriesId}`);

  const label = (formData.get("label") as string | null)?.trim() ?? "";
  const positionRaw = (formData.get("position") as string | null)?.trim() ?? "";
  if (!label) {
    return { status: "error", message: "Enter a name for this pin." };
  }
  if (label.length > MAX_SERIES_ITEM_LABEL_LENGTH) {
    return { status: "error", message: `Keep it under ${MAX_SERIES_ITEM_LABEL_LENGTH} characters.` };
  }
  let position: number | null = null;
  if (positionRaw) {
    const parsed = Number.parseInt(positionRaw, 10);
    if (!Number.isFinite(parsed) || parsed < 1) {
      return { status: "error", message: "Position must be a positive number." };
    }
    position = parsed;
  }

  const labelKey = normalizeSeriesKey(label);
  const existing = await prisma.seriesItem.findUnique({ where: { seriesId_labelKey: { seriesId, labelKey } } });
  if (existing) {
    revalidatePath(`/series/${seriesId}`);
    return { status: "ok" };
  }

  const limitMessage = await assertNotOverCreationLimit(user.id);
  if (limitMessage) {
    return { status: "error", message: limitMessage };
  }

  await prisma.seriesItem.create({ data: { seriesId, label, labelKey, position, createdBy: user.id } });
  revalidatePath(`/series/${seriesId}`);
  return { status: "ok" };
}

// "I have this one" — a public checkmark, not a holding (no acquisition
// date/place/photos). `linkedPinId` is optional and purely a convenience
// link-through to one of the claimant's own registered pins; a forged or
// mismatched value is silently dropped rather than failing the whole claim
// — the core action (claiming) shouldn't break over a cosmetic extra.
export async function claimItem(seriesId: string, seriesItemId: string, formData: FormData) {
  const user = await requireAppUser(`/series/${seriesId}`);

  const linkedPinIdRaw = (formData.get("linkedPinId") as string | null)?.trim() || null;
  let linkedPinId: string | null = null;
  if (linkedPinIdRaw) {
    const owns = await prisma.pinHolding.findFirst({ where: { pinId: linkedPinIdRaw, userId: user.id } });
    if (owns) linkedPinId = linkedPinIdRaw;
  }

  await prisma.seriesClaim.upsert({
    where: { seriesItemId_userId: { seriesItemId, userId: user.id } },
    update: { linkedPinId },
    create: { seriesItemId, userId: user.id, linkedPinId },
  });
  revalidatePath(`/series/${seriesId}`);
  revalidatePath("/my-pins");
}

export async function unclaimItem(seriesId: string, seriesItemId: string) {
  const user = await requireAppUser(`/series/${seriesId}`);
  await prisma.seriesClaim.deleteMany({ where: { seriesItemId, userId: user.id } });
  revalidatePath(`/series/${seriesId}`);
  revalidatePath("/my-pins");
}

// Additive-only editing (see the schema comment on Series): only the row's
// own creator can remove it, and only while nothing depends on it yet.
export async function deleteSeriesItem(seriesId: string, seriesItemId: string) {
  const user = await requireAppUser(`/series/${seriesId}`);
  const item = await prisma.seriesItem.findUnique({ where: { id: seriesItemId }, include: { _count: { select: { claims: true } } } });
  if (!item || item.createdBy !== user.id || item._count.claims > 0) return;
  await prisma.seriesItem.delete({ where: { id: seriesItemId } });
  revalidatePath(`/series/${seriesId}`);
}

export async function deleteSeries(seriesId: string) {
  const user = await requireAppUser("/series");
  const series = await prisma.series.findUnique({ where: { id: seriesId }, include: { _count: { select: { items: true } } } });
  if (!series || series.createdBy !== user.id || series._count.items > 0) return;
  await prisma.series.delete({ where: { id: seriesId } });
  redirect("/series");
}

function seriesUrl(id: string, linkPin: string): string {
  return linkPin ? `/series/${id}?linkPin=${encodeURIComponent(linkPin)}` : `/series/${id}`;
}
