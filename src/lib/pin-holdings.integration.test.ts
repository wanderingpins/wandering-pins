import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "./prisma";
import { generateSlug } from "./slug";

// Confirms the hand-written partial unique index from
// prisma/migrations/*_pin_holdings_partial_unique_open actually holds: a
// pin can never have two open (released_at IS NULL) holdings at once. This
// is exactly the invariant registerPin/confirmTrade rely on when closing
// the previous holding before opening the next.
describe("pin_holdings open-holding constraint", () => {
  const cleanup: { pinId?: string; batchId?: string; userIds: string[] } = { userIds: [] };

  afterEach(async () => {
    if (cleanup.pinId) await prisma.pinHolding.deleteMany({ where: { pinId: cleanup.pinId } });
    if (cleanup.pinId) await prisma.pin.delete({ where: { id: cleanup.pinId } }).catch(() => {});
    if (cleanup.batchId) await prisma.stickerBatch.delete({ where: { id: cleanup.batchId } }).catch(() => {});
    for (const id of cleanup.userIds) {
      await prisma.user.delete({ where: { id } }).catch(() => {});
    }
    cleanup.userIds = [];
  });

  it("rejects a second open holding on the same pin", async () => {
    const batch = await prisma.stickerBatch.create({ data: { label: "test", quantity: 1 } });
    cleanup.batchId = batch.id;
    const pin = await prisma.pin.create({
      data: { slug: generateSlug(), batchId: batch.id, status: "REGISTERED" },
    });
    cleanup.pinId = pin.id;

    const userA = await prisma.user.create({
      data: { id: randomUUID(), email: `a-${randomUUID()}@example.com`, displayName: "A" },
    });
    const userB = await prisma.user.create({
      data: { id: randomUUID(), email: `b-${randomUUID()}@example.com`, displayName: "B" },
    });
    cleanup.userIds.push(userA.id, userB.id);

    await prisma.pinHolding.create({
      data: {
        pinId: pin.id,
        userId: userA.id,
        acquiredAt: new Date(),
        acquiredVia: "BOUGHT",
        placeLabel: "Orlando, FL",
        lat: 28.5,
        lng: -81.4,
      },
    });

    await expect(
      prisma.pinHolding.create({
        data: {
          pinId: pin.id,
          userId: userB.id,
          acquiredAt: new Date(),
          acquiredVia: "TRADED",
          placeLabel: "Denver, CO",
          lat: 39.7,
          lng: -105.0,
        },
      })
    ).rejects.toThrow();
  });

  it("allows a new open holding once the previous one is released", async () => {
    const batch = await prisma.stickerBatch.create({ data: { label: "test", quantity: 1 } });
    cleanup.batchId = batch.id;
    const pin = await prisma.pin.create({
      data: { slug: generateSlug(), batchId: batch.id, status: "REGISTERED" },
    });
    cleanup.pinId = pin.id;

    const userA = await prisma.user.create({
      data: { id: randomUUID(), email: `a-${randomUUID()}@example.com`, displayName: "A" },
    });
    const userB = await prisma.user.create({
      data: { id: randomUUID(), email: `b-${randomUUID()}@example.com`, displayName: "B" },
    });
    cleanup.userIds.push(userA.id, userB.id);

    const first = await prisma.pinHolding.create({
      data: {
        pinId: pin.id,
        userId: userA.id,
        acquiredAt: new Date(),
        acquiredVia: "BOUGHT",
        placeLabel: "Orlando, FL",
        lat: 28.5,
        lng: -81.4,
      },
    });
    await prisma.pinHolding.update({ where: { id: first.id }, data: { releasedAt: new Date() } });

    await expect(
      prisma.pinHolding.create({
        data: {
          pinId: pin.id,
          userId: userB.id,
          acquiredAt: new Date(),
          acquiredVia: "TRADED",
          placeLabel: "Denver, CO",
          lat: 39.7,
          lng: -105.0,
        },
      })
    ).resolves.toMatchObject({ userId: userB.id });
  });
});
