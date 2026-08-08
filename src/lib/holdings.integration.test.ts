import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "./prisma";
import { generateSlug } from "./slug";
import { getOwnedHolding } from "./holdings";

// getOwnedHolding backs every private-data check (notes, titles, photos —
// brief section 10: "unreachable by anyone but their owner"). If this ever
// regresses, private data leaks, so it gets its own direct test rather than
// relying only on the routes that call it.
describe("getOwnedHolding", () => {
  const cleanup: { pinId?: string; batchId?: string; userIds: string[] } = { userIds: [] };

  afterEach(async () => {
    if (cleanup.pinId) {
      await prisma.pinHolding.deleteMany({ where: { pinId: cleanup.pinId } });
      await prisma.pin.delete({ where: { id: cleanup.pinId } }).catch(() => {});
    }
    if (cleanup.batchId) await prisma.stickerBatch.delete({ where: { id: cleanup.batchId } }).catch(() => {});
    for (const id of cleanup.userIds) {
      await prisma.user.delete({ where: { id } }).catch(() => {});
    }
    cleanup.userIds = [];
  });

  it("returns the holding for its owner, and null for anyone else or a bogus id", async () => {
    const batch = await prisma.stickerBatch.create({ data: { label: "test", quantity: 1 } });
    cleanup.batchId = batch.id;
    const pin = await prisma.pin.create({ data: { slug: generateSlug(), batchId: batch.id, status: "REGISTERED" } });
    cleanup.pinId = pin.id;

    const owner = await prisma.user.create({
      data: { id: randomUUID(), email: `owner-${randomUUID()}@example.com`, username: `owner_${randomUUID().slice(0, 8)}` },
    });
    const stranger = await prisma.user.create({
      data: { id: randomUUID(), email: `stranger-${randomUUID()}@example.com`, username: `stranger_${randomUUID().slice(0, 8)}` },
    });
    cleanup.userIds.push(owner.id, stranger.id);

    const holding = await prisma.pinHolding.create({
      data: {
        pinId: pin.id,
        userId: owner.id,
        acquiredAt: new Date(),
        acquiredVia: "BOUGHT",
        placeLabel: "Orlando, FL",
        lat: 28.5,
        lng: -81.4,
      },
    });

    expect((await getOwnedHolding(holding.id, owner.id))?.id).toBe(holding.id);
    expect(await getOwnedHolding(holding.id, stranger.id)).toBeNull();
    expect(await getOwnedHolding("not-a-real-id", owner.id)).toBeNull();
  });
});
