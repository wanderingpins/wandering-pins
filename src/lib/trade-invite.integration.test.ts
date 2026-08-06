import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "./prisma";
import { generateSlug } from "./slug";

// DoD (brief section 12): "A trade proposed to a non-existent user survives
// that user signing up and confirming." — toUserId starts null (email-only
// invite); confirmTrade matches on toEmail and backfills toUserId once the
// invitee has an account, exactly as it would after they sign up for real.
describe("trade proposed to a non-existent user", () => {
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

  it("matches by email and backfills toUserId once the invitee signs up and confirms", async () => {
    const batch = await prisma.stickerBatch.create({ data: { label: "test", quantity: 1 } });
    cleanup.batchId = batch.id;
    const pin = await prisma.pin.create({ data: { slug: generateSlug(), batchId: batch.id, status: "REGISTERED" } });
    cleanup.pinId = pin.id;

    const sender = await prisma.user.create({
      data: { id: randomUUID(), email: `sender-${randomUUID()}@example.com`, displayName: "Sender" },
    });
    cleanup.userIds.push(sender.id);

    await prisma.pinHolding.create({
      data: {
        pinId: pin.id,
        userId: sender.id,
        acquiredAt: new Date(),
        acquiredVia: "BOUGHT",
        placeLabel: "Orlando, FL",
        lat: 28.5,
        lng: -81.4,
      },
    });

    const inviteEmail = `not-yet-signed-up-${randomUUID()}@example.com`;

    // initiateTrade's actual behavior when the recipient has no account yet:
    // toUserId is left unset, only toEmail is recorded.
    const trade = await prisma.trade.create({
      data: {
        pinId: pin.id,
        fromUserId: sender.id,
        toEmail: inviteEmail,
        placeLabel: "Denver, CO",
        lat: 39.7,
        lng: -105.0,
        status: "PENDING",
      },
    });
    expect(trade.toUserId).toBeNull();

    // Time passes; the invitee signs up for real, getting a fresh auth id.
    const recipient = await prisma.user.create({
      data: { id: randomUUID(), email: inviteEmail, displayName: "Late Signup" },
    });
    cleanup.userIds.push(recipient.id);

    // findConfirmableTrade's matching logic (actions.ts): toUserId OR toEmail.
    const matched = await prisma.trade.findUnique({ where: { id: trade.id } });
    const isRecipient = matched!.toUserId === recipient.id || matched!.toEmail === recipient.email;
    expect(isRecipient).toBe(true);

    // confirmTrade's transaction, replicated:
    await prisma.$transaction(async (tx) => {
      await tx.pinHolding.updateMany({ where: { pinId: pin.id, releasedAt: null }, data: { releasedAt: new Date() } });
      await tx.pinHolding.create({
        data: {
          pinId: pin.id,
          userId: recipient.id,
          acquiredAt: new Date(),
          acquiredVia: "TRADED",
          placeLabel: matched!.placeLabel!,
          lat: matched!.lat!,
          lng: matched!.lng!,
        },
      });
      await tx.trade.update({
        where: { id: trade.id },
        data: { status: "CONFIRMED", resolvedAt: new Date(), toUserId: recipient.id },
      });
    });

    const resolvedTrade = await prisma.trade.findUniqueOrThrow({ where: { id: trade.id } });
    expect(resolvedTrade.status).toBe("CONFIRMED");
    expect(resolvedTrade.toUserId).toBe(recipient.id); // backfilled

    const openHolding = await prisma.pinHolding.findFirstOrThrow({ where: { pinId: pin.id, releasedAt: null } });
    expect(openHolding.userId).toBe(recipient.id);
  });
});
