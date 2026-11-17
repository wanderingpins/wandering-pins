"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isAdminEmail, requireAppUser } from "@/lib/auth";
import { processHoldingPhoto } from "@/lib/image";
import { MAX_RAW_UPLOAD_BYTES } from "@/lib/photo-limits";
import { deleteHoldingPhoto, downloadHoldingPhoto, uploadHoldingPhoto } from "@/lib/storage";
import { canRemoveSeriesItem, normalizeSeriesKey, MAX_SERIES_NAME_LENGTH, MAX_SERIES_ITEM_LABEL_LENGTH } from "@/lib/series";

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
// series" on /p/[number] stays on that same errand across the redirect.
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

// Whoever added a design can take it back out while it's only theirs — nobody
// else has claimed it (their own claim goes with it). Once someone else has
// it on their checklist, only an admin can remove it, so nobody's checklist
// changes under them. See canRemoveSeriesItem for the same rule in the UI.
export async function deleteSeriesItem(seriesId: string, seriesItemId: string) {
  const user = await requireAppUser(`/series/${seriesId}`);
  const item = await prisma.seriesItem.findUnique({
    where: { id: seriesItemId },
    include: { claims: { select: { userId: true } } },
  });
  if (!item || item.seriesId !== seriesId) return;
  if (!canRemoveSeriesItem(item, user.id, isAdminEmail(user.email))) return;
  await prisma.$transaction([
    prisma.seriesClaim.deleteMany({ where: { seriesItemId } }),
    prisma.seriesItem.delete({ where: { id: seriesItemId } }),
  ]);
  if (item.imagePath) await deleteHoldingPhoto(item.imagePath).catch(() => undefined);
  revalidatePath(`/series/${seriesId}`);
  revalidatePath("/series");
}

export async function deleteSeries(seriesId: string) {
  const user = await requireAppUser("/series");
  const series = await prisma.series.findUnique({ where: { id: seriesId }, include: { _count: { select: { items: true } } } });
  if (!series || series.createdBy !== user.id || series._count.items > 0) return;
  await prisma.series.delete({ where: { id: seriesId } });
  redirect("/series");
}

// --- Reference images on series items (see SeriesItem.imagePath) ---

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

// Anyone signed in can give an item its first image; after that only whoever
// added it (or an admin) can replace or remove it, so a picture someone took
// the trouble to add can't be swapped out from under them.
export async function setSeriesItemImage(
  seriesId: string,
  seriesItemId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireAppUser(`/series/${seriesId}`);
  const item = await prisma.seriesItem.findUnique({ where: { id: seriesItemId } });
  if (!item || item.seriesId !== seriesId) return { status: "error", message: "That pin isn't in this series." };
  if (item.imagePath && item.imageBy !== user.id && !isAdminEmail(user.email)) {
    return { status: "error", message: "Someone else added this picture, so only they can change it." };
  }

  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) return { status: "error", message: "Choose a picture first." };
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) return { status: "error", message: "Please use a JPEG, PNG, or WebP image." };
  if (file.size > MAX_RAW_UPLOAD_BYTES) return { status: "error", message: "That image is too large (max 10MB)." };

  const limitMessage = await assertNotOverCreationLimit(user.id);
  if (limitMessage) return { status: "error", message: limitMessage };

  let processed: Buffer;
  try {
    processed = await processHoldingPhoto(Buffer.from(await file.arrayBuffer()));
  } catch {
    return { status: "error", message: "That file doesn't look like a valid image." };
  }
  const path = await uploadHoldingPhoto(`series-items/${seriesItemId}`, processed, "image/jpeg");

  // Set the new one before deleting the old file, so a failed delete leaves
  // an orphaned file rather than an item pointing at nothing.
  await prisma.seriesItem.update({
    where: { id: seriesItemId },
    data: { imagePath: path, imageBy: user.id, imageAddedAt: new Date() },
  });
  if (item.imagePath) await deleteHoldingPhoto(item.imagePath).catch(() => undefined);

  revalidatePath(`/series/${seriesId}`);
  return { status: "ok" };
}

export async function removeSeriesItemImage(seriesId: string, seriesItemId: string) {
  const user = await requireAppUser(`/series/${seriesId}`);
  const item = await prisma.seriesItem.findUnique({ where: { id: seriesItemId } });
  if (!item?.imagePath || item.seriesId !== seriesId) return;
  if (item.imageBy !== user.id && !isAdminEmail(user.email)) return;
  await prisma.seriesItem.update({
    where: { id: seriesItemId },
    data: { imagePath: null, imageBy: null, imageAddedAt: null },
  });
  await deleteHoldingPhoto(item.imagePath).catch(() => undefined);
  revalidatePath(`/series/${seriesId}`);
}

// Link (or re-link, or unlink with an empty value) one of your own pins to an
// item you've already claimed — the "Your pin" picker on the series page. The
// claim itself already exists, so this only sets linkedPinId; the pin's page
// then says "Part of a series". `pinId` comes from the form, so ownership is
// re-checked here (any stint of yours with that pin counts, matching claimItem).
export async function setClaimLinkedPin(seriesId: string, seriesItemId: string, formData: FormData) {
  const user = await requireAppUser(`/series/${seriesId}`);
  const pinId = String(formData.get("pinId") ?? "").trim() || null;
  if (pinId) {
    const owns = await prisma.pinHolding.findFirst({ where: { pinId, userId: user.id } });
    if (!owns) return;
  }
  const before = await prisma.seriesClaim.findUnique({
    where: { seriesItemId_userId: { seriesItemId, userId: user.id } },
    select: { linkedPin: { select: { number: true } } },
  });
  if (!before) return;
  await prisma.seriesClaim.update({
    where: { seriesItemId_userId: { seriesItemId, userId: user.id } },
    data: { linkedPinId: pinId },
  });
  const after = pinId ? await prisma.pin.findUnique({ where: { id: pinId }, select: { number: true } }) : null;
  revalidatePath(`/series/${seriesId}`);
  if (before.linkedPin) revalidatePath(`/p/${before.linkedPin.number}`);
  if (after) revalidatePath(`/p/${after.number}`);
}

// "Use my pin's photo": copies the public front photo of a pin you currently
// hold into this item's picture. A real COPY (a new file in storage), not a
// pointer — changing or deleting your pin's photo later must never change the
// series picture. Same permission rule as uploading one (setSeriesItemImage).
export async function copyPinPhotoToItem(seriesId: string, seriesItemId: string, pinId: string): Promise<ActionState> {
  const user = await requireAppUser(`/series/${seriesId}`);
  const item = await prisma.seriesItem.findUnique({ where: { id: seriesItemId } });
  if (!item || item.seriesId !== seriesId) return { status: "error", message: "That pin isn't in this series." };
  if (item.imagePath && item.imageBy !== user.id && !isAdminEmail(user.email)) {
    return { status: "error", message: "Someone else added this picture, so only they can change it." };
  }

  const holding = await prisma.pinHolding.findFirst({
    where: { pinId, userId: user.id, releasedAt: null, pending: false },
    select: { photos: { where: { kind: "FRONT" }, select: { url: true }, take: 1 } },
  });
  const source = holding?.photos[0];
  if (!source) return { status: "error", message: "That pin doesn't have a photo yet." };

  const limitMessage = await assertNotOverCreationLimit(user.id);
  if (limitMessage) return { status: "error", message: limitMessage };

  const downloaded = await downloadHoldingPhoto(source.url);
  if (!downloaded) return { status: "error", message: "Couldn't read your pin's photo. Please try again." };
  const path = await uploadHoldingPhoto(
    `series-items/${seriesItemId}`,
    Buffer.from(await downloaded.data.arrayBuffer()),
    downloaded.contentType
  );

  await prisma.seriesItem.update({
    where: { id: seriesItemId },
    data: { imagePath: path, imageBy: user.id, imageAddedAt: new Date() },
  });
  if (item.imagePath) await deleteHoldingPhoto(item.imagePath).catch(() => undefined);

  revalidatePath(`/series/${seriesId}`);
  return { status: "ok" };
}

function seriesUrl(id: string, linkPin: string): string {
  return linkPin ? `/series/${id}?linkPin=${encodeURIComponent(linkPin)}` : `/series/${id}`;
}
