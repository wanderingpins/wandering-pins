import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "./prisma";
import { generateSlug } from "./slug";

// Confirms the hand-written partial unique index holds: a pin can never
// have two open (released_at IS NULL) holdings at once. This was briefly
// dropped to support two-sided addressed trades (a giver's and receiver's
// holdings both open while one side hadn't acted yet), then restored once
// that model was retired in favor of one-sided, unaddressed release (brief
// section 6.4) — release is atomic and instant, so there's a gap between
// someone releasing and someone else claiming, never an overlap. This is
// exactly the invariant registerPin relies on to reject a race where two
// people try to claim the same released pin at once.
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
      data: { id: randomUUID(), email: `a-${randomUUID()}@example.com`, username: `a_${randomUUID().slice(0, 8)}` },
    });
    const userB = await prisma.user.create({
      data: { id: randomUUID(), email: `b-${randomUUID()}@example.com`, username: `b_${randomUUID().slice(0, 8)}` },
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
      data: { id: randomUUID(), email: `a-${randomUUID()}@example.com`, username: `a_${randomUUID().slice(0, 8)}` },
    });
    const userB = await prisma.user.create({
      data: { id: randomUUID(), email: `b-${randomUUID()}@example.com`, username: `b_${randomUUID().slice(0, 8)}` },
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

// Confirms the pair of partial unique indexes backing tentative
// ("unreleased") claims: registerPin now allows someone to claim a
// still-held pin, but only as `pending`, and only one at a time — the real
// confirmed holding and one pending claim can coexist, but not two of
// either kind. See registerPin (register/[slug]/actions.ts) and releasePin
// (trade/[slug]/actions.ts, which auto-promotes the pending row).
describe("pin_holdings pending-claim constraint", () => {
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

  it("allows a pending claim to coexist with a confirmed open holding", async () => {
    const batch = await prisma.stickerBatch.create({ data: { label: "test", quantity: 1 } });
    cleanup.batchId = batch.id;
    const pin = await prisma.pin.create({
      data: { slug: generateSlug(), batchId: batch.id, status: "REGISTERED" },
    });
    cleanup.pinId = pin.id;

    const userA = await prisma.user.create({
      data: { id: randomUUID(), email: `a-${randomUUID()}@example.com`, username: `a_${randomUUID().slice(0, 8)}` },
    });
    const userB = await prisma.user.create({
      data: { id: randomUUID(), email: `b-${randomUUID()}@example.com`, username: `b_${randomUUID().slice(0, 8)}` },
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
          pending: true,
        },
      })
    ).resolves.toMatchObject({ userId: userB.id, pending: true });
  });

  it("rejects a second pending claim on the same pin", async () => {
    const batch = await prisma.stickerBatch.create({ data: { label: "test", quantity: 1 } });
    cleanup.batchId = batch.id;
    const pin = await prisma.pin.create({
      data: { slug: generateSlug(), batchId: batch.id, status: "REGISTERED" },
    });
    cleanup.pinId = pin.id;

    const userA = await prisma.user.create({
      data: { id: randomUUID(), email: `a-${randomUUID()}@example.com`, username: `a_${randomUUID().slice(0, 8)}` },
    });
    const userB = await prisma.user.create({
      data: { id: randomUUID(), email: `b-${randomUUID()}@example.com`, username: `b_${randomUUID().slice(0, 8)}` },
    });
    const userC = await prisma.user.create({
      data: { id: randomUUID(), email: `c-${randomUUID()}@example.com`, username: `c_${randomUUID().slice(0, 8)}` },
    });
    cleanup.userIds.push(userA.id, userB.id, userC.id);

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
    await prisma.pinHolding.create({
      data: {
        pinId: pin.id,
        userId: userB.id,
        acquiredAt: new Date(),
        acquiredVia: "TRADED",
        placeLabel: "Denver, CO",
        lat: 39.7,
        lng: -105.0,
        pending: true,
      },
    });

    await expect(
      prisma.pinHolding.create({
        data: {
          pinId: pin.id,
          userId: userC.id,
          acquiredAt: new Date(),
          acquiredVia: "TRADED",
          placeLabel: "Seattle, WA",
          lat: 47.6,
          lng: -122.3,
          pending: true,
        },
      })
    ).rejects.toThrow();
  });
});
