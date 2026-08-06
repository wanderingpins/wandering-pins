import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "./prisma";
import { generateSlug } from "./slug";

// Models the same transaction confirmTrade (src/app/register/[slug]/actions.ts)
// runs, at the DB layer, to confirm the full lifecycle: closing the sender's
// holding, opening the recipient's, and marking the trade CONFIRMED —
// without cascading-deleting anything (gotcha #9).
describe("trade confirmation lifecycle", () => {
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

  it("closes the sender's holding, opens the recipient's, and confirms the trade", async () => {
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
        fromUserId: sender.id,
        toEmail: recipient.email,
        toUserId: recipient.id,
        placeLabel: "Denver, CO",
        lat: 39.7,
        lng: -105.0,
        status: "PENDING",
      },
    });

    // The confirmTrade transaction, replicated:
    await prisma.$transaction(async (tx) => {
      await tx.pinHolding.updateMany({
        where: { pinId: pin.id, releasedAt: null },
        data: { releasedAt: new Date() },
      });
      await tx.pinHolding.create({
        data: {
          pinId: pin.id,
          userId: recipient.id,
          acquiredAt: new Date(),
          acquiredVia: "TRADED",
          placeLabel: trade.placeLabel!,
          lat: trade.lat!,
          lng: trade.lng!,
        },
      });
      await tx.trade.update({
        where: { id: trade.id },
        data: { status: "CONFIRMED", resolvedAt: new Date() },
      });
    });

    const holdings = await prisma.pinHolding.findMany({ where: { pinId: pin.id }, orderBy: { acquiredAt: "asc" } });
    expect(holdings).toHaveLength(2);

    const closedSenderHolding = holdings.find((h) => h.id === senderHolding.id)!;
    expect(closedSenderHolding.releasedAt).not.toBeNull();

    const openHolding = holdings.find((h) => h.releasedAt === null)!;
    expect(openHolding.userId).toBe(recipient.id);
    expect(openHolding.placeLabel).toBe("Denver, CO");

    const resolvedTrade = await prisma.trade.findUniqueOrThrow({ where: { id: trade.id } });
    expect(resolvedTrade.status).toBe("CONFIRMED");
    expect(resolvedTrade.resolvedAt).not.toBeNull();
  });
});
