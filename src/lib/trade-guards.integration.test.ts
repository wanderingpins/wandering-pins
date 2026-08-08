import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "./prisma";
import { generateSlug } from "./slug";

// initiateTrade's guard (src/app/trade/[slug]/actions.ts): only one live
// PENDING trade per giver+pin at a time, regardless of claimedAt — without
// this, the same open holding could be claimed by two different recipients
// once claim and release were decoupled. cancelTrade is the escape hatch:
// voiding an unclaimed offer clears the guard so the giver can re-offer.
describe("initiateTrade's one-live-offer guard", () => {
  const cleanup: { pinId?: string; batchId?: string; userIds: string[] } = { userIds: [] };

  afterEach(async () => {
    if (cleanup.pinId) {
      await prisma.trade.deleteMany({ where: { pinId: cleanup.pinId } });
      await prisma.pinHolding.deleteMany({ where: { pinId: cleanup.pinId } });
      await prisma.pin.delete({ where: { id: cleanup.pinId } }).catch(() => {});
    }
    if (cleanup.batchId) await prisma.stickerBatch.delete({ where: { id: cleanup.batchId } }).catch(() => {});
    for (const id of cleanup.userIds) {
      await prisma.user.delete({ where: { id } }).catch(() => {});
    }
    cleanup.userIds = [];
  });

  async function setUp() {
    const batch = await prisma.stickerBatch.create({ data: { label: "test", quantity: 1 } });
    cleanup.batchId = batch.id;
    const pin = await prisma.pin.create({
      data: { slug: generateSlug(), batchId: batch.id, status: "REGISTERED" },
    });
    cleanup.pinId = pin.id;

    const giver = await prisma.user.create({
      data: { id: randomUUID(), email: `giver-${randomUUID()}@example.com`, username: `giver_${randomUUID().slice(0, 8)}` },
    });
    cleanup.userIds.push(giver.id);

    const holding = await prisma.pinHolding.create({
      data: {
        pinId: pin.id,
        userId: giver.id,
        acquiredAt: new Date(),
        acquiredVia: "BOUGHT",
        placeLabel: "Orlando, FL",
        lat: 28.5,
        lng: -81.4,
      },
    });

    return { pin, giver, holding };
  }

  // The exact guard query initiateTrade runs before creating a new Trade.
  async function findBlockingTrade(pinId: string, fromUserId: string) {
    return prisma.trade.findFirst({ where: { pinId, fromUserId, status: "PENDING" } });
  }

  it("blocks a second offer while the first is unclaimed, and again after it's claimed", async () => {
    const { pin, giver, holding } = await setUp();

    expect(await findBlockingTrade(pin.id, giver.id)).toBeNull();

    const trade = await prisma.trade.create({
      data: {
        pinId: pin.id,
        holdingId: holding.id,
        fromUserId: giver.id,
        toEmail: "recipient1@example.com",
        placeLabel: "Denver, CO",
        lat: 39.7,
        lng: -105.0,
        status: "PENDING",
      },
    });

    expect((await findBlockingTrade(pin.id, giver.id))?.id).toBe(trade.id);

    // Claiming doesn't clear the guard — the giver's holding is still open
    // and unreleased, so a second offer would let two people claim it.
    await prisma.trade.update({ where: { id: trade.id }, data: { claimedAt: new Date() } });
    expect((await findBlockingTrade(pin.id, giver.id))?.id).toBe(trade.id);
  });

  it("cancelTrade clears the guard so a new offer can be made", async () => {
    const { pin, giver, holding } = await setUp();

    const trade = await prisma.trade.create({
      data: {
        pinId: pin.id,
        holdingId: holding.id,
        fromUserId: giver.id,
        toEmail: "recipient1@example.com",
        placeLabel: "Denver, CO",
        lat: 39.7,
        lng: -105.0,
        status: "PENDING",
      },
    });
    expect(await findBlockingTrade(pin.id, giver.id)).not.toBeNull();

    // cancelTrade's effect: status -> DECLINED, resolvedAt set.
    await prisma.trade.update({
      where: { id: trade.id },
      data: { status: "DECLINED", resolvedAt: new Date() },
    });

    expect(await findBlockingTrade(pin.id, giver.id)).toBeNull();

    const secondTrade = await prisma.trade.create({
      data: {
        pinId: pin.id,
        holdingId: holding.id,
        fromUserId: giver.id,
        toEmail: "recipient2@example.com",
        placeLabel: "Austin, TX",
        lat: 30.3,
        lng: -97.7,
        status: "PENDING",
      },
    });
    expect((await findBlockingTrade(pin.id, giver.id))?.id).toBe(secondTrade.id);
  });
});
