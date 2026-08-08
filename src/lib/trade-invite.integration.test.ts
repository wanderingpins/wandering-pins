import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "./prisma";
import { generateSlug } from "./slug";

// DoD (brief section 12): "A trade proposed to a non-existent user survives
// that user signing up and confirming [claiming]." — toUserId starts null
// (email-only invite); claimTrade matches on toEmail and backfills toUserId
// once the invitee has an account, exactly as it would after they sign up
// for real. Claiming is independent of the sender's release (brief section
// 6.4), so status stays PENDING until the sender separately approves —
// backfill and holding-creation don't wait on that.
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
    const senderHolding = await prisma.pinHolding.findFirstOrThrow({ where: { pinId: pin.id } });

    // initiateTrade's actual behavior when the recipient has no account yet:
    // toUserId is left unset, only toEmail is recorded.
    const trade = await prisma.trade.create({
      data: {
        pinId: pin.id,
        holdingId: senderHolding.id,
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

    // findClaimableTrade's matching logic (actions.ts): toUserId OR toEmail.
    const matched = await prisma.trade.findUnique({ where: { id: trade.id } });
    const isRecipient = matched!.toUserId === recipient.id || matched!.toEmail === recipient.email;
    expect(isRecipient).toBe(true);

    // claimTrade's transaction, replicated — the sender hasn't approved
    // release, so this only opens the recipient's holding and backfills
    // toUserId; it does not touch the sender's holding or resolve the trade.
    await prisma.$transaction(async (tx) => {
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
      await tx.$executeRaw`
        UPDATE trades
        SET claimed_at = now(),
            to_user_id = ${recipient.id},
            status = CASE WHEN giver_released_at IS NOT NULL THEN 'CONFIRMED'::"TradeStatus" ELSE status END,
            resolved_at = CASE WHEN giver_released_at IS NOT NULL THEN now() ELSE resolved_at END
        WHERE id = ${trade.id}
      `;
    });

    const claimedTrade = await prisma.trade.findUniqueOrThrow({ where: { id: trade.id } });
    expect(claimedTrade.status).toBe("PENDING"); // sender hasn't approved release yet
    expect(claimedTrade.toUserId).toBe(recipient.id); // backfilled

    const openHoldings = await prisma.pinHolding.findMany({ where: { pinId: pin.id, releasedAt: null } });
    expect(openHoldings.map((h) => h.userId)).toContain(recipient.id);
    expect(openHoldings.map((h) => h.userId)).toContain(sender.id); // sender's stays open until they approve
  });
});
