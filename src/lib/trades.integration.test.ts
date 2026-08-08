import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "./prisma";
import { generateSlug } from "./slug";

// Models, at the DB layer, the two independent transactions claimTrade and
// approveRelease (src/app/register/[slug]/actions.ts) run — claiming and
// releasing are one-sided and order-independent (brief section 6.4), unlike
// the single atomic confirmTrade this replaced. status/resolvedAt only
// promote to CONFIRMED once both claimed_at and giver_released_at are set,
// via the atomic CASE update (not read-then-write) that avoids a race where
// both timestamps land but status is never promoted.
async function claim(tradeId: string, pinId: string, recipientId: string, trade: { placeLabel: string; lat: number; lng: number }) {
  await prisma.$transaction(async (tx) => {
    await tx.pinHolding.create({
      data: {
        pinId,
        userId: recipientId,
        acquiredAt: new Date(),
        acquiredVia: "TRADED",
        placeLabel: trade.placeLabel,
        lat: trade.lat,
        lng: trade.lng,
      },
    });
    await tx.$executeRaw`
      UPDATE trades
      SET claimed_at = now(),
          to_user_id = ${recipientId},
          status = CASE WHEN giver_released_at IS NOT NULL THEN 'CONFIRMED'::"TradeStatus" ELSE status END,
          resolved_at = CASE WHEN giver_released_at IS NOT NULL THEN now() ELSE resolved_at END
      WHERE id = ${tradeId}
    `;
  });
}

async function approveRelease(tradeId: string, holdingId: string) {
  await prisma.$transaction(async (tx) => {
    await tx.pinHolding.updateMany({
      where: { id: holdingId, releasedAt: null },
      data: { releasedAt: new Date() },
    });
    await tx.$executeRaw`
      UPDATE trades
      SET giver_released_at = now(),
          status = CASE WHEN claimed_at IS NOT NULL THEN 'CONFIRMED'::"TradeStatus" ELSE status END,
          resolved_at = CASE WHEN claimed_at IS NOT NULL THEN now() ELSE resolved_at END
      WHERE id = ${tradeId}
    `;
  });
}

describe("decoupled trade claim/release lifecycle", () => {
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

    const sender = await prisma.user.create({
      data: { id: randomUUID(), email: `sender-${randomUUID()}@example.com`, displayName: "Sender" },
    });
    const recipient = await prisma.user.create({
      data: { id: randomUUID(), email: `recipient-${randomUUID()}@example.com`, displayName: "Recipient" },
    });
    cleanup.userIds.push(sender.id, recipient.id);

    const senderHolding = await prisma.pinHolding.create({
      data: {
        pinId: pin.id,
        userId: sender.id,
        acquiredAt: new Date("2024-01-01"),
        acquiredVia: "BOUGHT",
        placeLabel: "Orlando, FL",
        lat: 28.5,
        lng: -81.4,
      },
    });

    const trade = await prisma.trade.create({
      data: {
        pinId: pin.id,
        holdingId: senderHolding.id,
        fromUserId: sender.id,
        toEmail: recipient.email,
        toUserId: recipient.id,
        placeLabel: "Denver, CO",
        lat: 39.7,
        lng: -105.0,
        status: "PENDING",
      },
    });

    return { pin, sender, recipient, senderHolding, trade };
  }

  it("claim before release: recipient's holding opens immediately, sender's stays open until approved", async () => {
    const { pin, recipient, senderHolding, trade } = await setUp();

    await claim(trade.id, pin.id, recipient.id, { placeLabel: trade.placeLabel!, lat: trade.lat!, lng: trade.lng! });

    const midHoldings = await prisma.pinHolding.findMany({ where: { pinId: pin.id } });
    expect(midHoldings).toHaveLength(2);
    expect(midHoldings.filter((h) => h.releasedAt === null)).toHaveLength(2);

    const midTrade = await prisma.trade.findUniqueOrThrow({ where: { id: trade.id } });
    expect(midTrade.status).toBe("PENDING");
    expect(midTrade.claimedAt).not.toBeNull();
    expect(midTrade.giverReleasedAt).toBeNull();

    await approveRelease(trade.id, senderHolding.id);

    const finalHoldings = await prisma.pinHolding.findMany({ where: { pinId: pin.id } });
    expect(finalHoldings.find((h) => h.id === senderHolding.id)!.releasedAt).not.toBeNull();
    expect(finalHoldings.filter((h) => h.releasedAt === null)).toHaveLength(1);

    const finalTrade = await prisma.trade.findUniqueOrThrow({ where: { id: trade.id } });
    expect(finalTrade.status).toBe("CONFIRMED");
    expect(finalTrade.resolvedAt).not.toBeNull();
  });

  it("release before claim: sender's holding closes immediately, recipient can still claim later", async () => {
    const { pin, recipient, senderHolding, trade } = await setUp();

    await approveRelease(trade.id, senderHolding.id);

    const midHoldings = await prisma.pinHolding.findMany({ where: { pinId: pin.id } });
    expect(midHoldings.find((h) => h.id === senderHolding.id)!.releasedAt).not.toBeNull();

    const midTrade = await prisma.trade.findUniqueOrThrow({ where: { id: trade.id } });
    expect(midTrade.status).toBe("PENDING");
    expect(midTrade.giverReleasedAt).not.toBeNull();
    expect(midTrade.claimedAt).toBeNull();

    await claim(trade.id, pin.id, recipient.id, { placeLabel: trade.placeLabel!, lat: trade.lat!, lng: trade.lng! });

    const finalHoldings = await prisma.pinHolding.findMany({ where: { pinId: pin.id } });
    const openHolding = finalHoldings.find((h) => h.releasedAt === null)!;
    expect(openHolding.userId).toBe(recipient.id);

    const finalTrade = await prisma.trade.findUniqueOrThrow({ where: { id: trade.id } });
    expect(finalTrade.status).toBe("CONFIRMED");
    expect(finalTrade.resolvedAt).not.toBeNull();
  });
});
