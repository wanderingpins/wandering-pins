"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { deleteHoldingPhoto } from "@/lib/storage";
import { normalizeSeriesKey } from "@/lib/series";

// Moderation actions for /admin. Every one re-checks requireAdmin itself — a
// server action is callable without ever loading the page — and each only
// touches PUBLIC content (a pin's public photo/name/description, the series
// catalog). Private notes and private photos are not reachable from here.

function done() {
  revalidatePath("/admin");
  revalidatePath("/pins");
  revalidatePath("/series");
}

// Remove a pin's public front photo (the one on /pins and /p/{number}).
export async function adminDeletePinPhoto(photoId: string) {
  await requireAdmin();
  const photo = await prisma.holdingPhoto.findUnique({ where: { id: photoId } });
  if (!photo || photo.kind !== "FRONT") return;
  await prisma.holdingPhoto.delete({ where: { id: photoId } });
  await deleteHoldingPhoto(photo.url).catch(() => undefined);
  done();
}

// Blank a pin's public name and description (shows as "Untitled Pin"), and
// unshare its story — the story itself stays, private to its writer.
export async function adminClearPinText(holdingId: string) {
  await requireAdmin();
  await prisma.pinTitle.updateMany({ where: { holdingId }, data: { title: "", description: null } });
  await prisma.holdingNote.updateMany({ where: { holdingId }, data: { isPublic: false } });
  done();
}

export async function adminRemoveSeriesImage(seriesItemId: string) {
  await requireAdmin();
  const item = await prisma.seriesItem.findUnique({ where: { id: seriesItemId } });
  if (!item?.imagePath) return;
  await prisma.seriesItem.update({ where: { id: seriesItemId }, data: { imagePath: null, imageBy: null, imageAddedAt: null } });
  await deleteHoldingPhoto(item.imagePath).catch(() => undefined);
  done();
  revalidatePath(`/series/${item.seriesId}`);
}

export async function adminRemoveSeriesBoxImage(seriesId: string) {
  await requireAdmin();
  const series = await prisma.series.findUnique({ where: { id: seriesId } });
  if (!series?.boxImagePath) return;
  await prisma.series.update({ where: { id: seriesId }, data: { boxImagePath: null, boxImageBy: null, boxImageAddedAt: null } });
  await deleteHoldingPhoto(series.boxImagePath).catch(() => undefined);
  done();
  revalidatePath(`/series/${seriesId}`);
}

// Unlike the creator's own delete, an admin can remove an item that people
// have already claimed — their claims on it go with it.
export async function adminDeleteSeriesItem(seriesItemId: string) {
  await requireAdmin();
  const item = await prisma.seriesItem.findUnique({ where: { id: seriesItemId } });
  if (!item) return;
  await prisma.$transaction([
    prisma.seriesClaim.deleteMany({ where: { seriesItemId } }),
    prisma.seriesItem.delete({ where: { id: seriesItemId } }),
  ]);
  if (item.imagePath) await deleteHoldingPhoto(item.imagePath).catch(() => undefined);
  done();
  revalidatePath(`/series/${item.seriesId}`);
}

// Rename a series (fixing a typo or an inappropriate name). Refuses a name
// that collides with another series, since names are unique by key.
export async function adminRenameSeries(seriesId: string, formData: FormData) {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  if (!name || name.length > 100) return;
  const nameKey = normalizeSeriesKey(name);
  const clash = await prisma.series.findUnique({ where: { nameKey } });
  if (clash && clash.id !== seriesId) return;
  await prisma.series.update({ where: { id: seriesId }, data: { name, nameKey } });
  done();
  revalidatePath(`/series/${seriesId}`);
}

// Whole series, with every item and claim in it.
export async function adminDeleteSeries(seriesId: string) {
  await requireAdmin();
  const items = await prisma.seriesItem.findMany({ where: { seriesId }, select: { id: true, imagePath: true } });
  const box = await prisma.series.findUnique({ where: { id: seriesId }, select: { boxImagePath: true } });
  const itemIds = items.map((i) => i.id);
  await prisma.$transaction([
    prisma.seriesClaim.deleteMany({ where: { seriesItemId: { in: itemIds } } }),
    prisma.seriesItem.deleteMany({ where: { seriesId } }),
    prisma.series.delete({ where: { id: seriesId } }),
  ]);
  for (const i of items) if (i.imagePath) await deleteHoldingPhoto(i.imagePath).catch(() => undefined);
  if (box?.boxImagePath) await deleteHoldingPhoto(box.boxImagePath).catch(() => undefined);
  done();
}
