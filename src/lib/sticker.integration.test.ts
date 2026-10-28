import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "./prisma";
import { generateSlug } from "./slug";
import { loadDirectoryPage } from "./pin-directory";

// The sticker code is the wander credential: it must never reach a public
// surface, and a pin can carry at most one sticker. See Sticker in
// schema.prisma.
describe("stickers", () => {
  const cleanup: { pinIds: string[]; batchId?: string; userId?: string } = { pinIds: [] };

  afterEach(async () => {
    const holdings = { holding: { pinId: { in: cleanup.pinIds } } };
    await prisma.pinTitle.deleteMany({ where: holdings });
    await prisma.pinHolding.deleteMany({ where: { pinId: { in: cleanup.pinIds } } });
    await prisma.sticker.deleteMany({ where: { pinId: { in: cleanup.pinIds } } });
    if (cleanup.batchId) {
      await prisma.sticker.deleteMany({ where: { batchId: cleanup.batchId } });
      await prisma.stickerBatch.delete({ where: { id: cleanup.batchId } }).catch(() => {});
    }
    await prisma.pin.deleteMany({ where: { id: { in: cleanup.pinIds } } });
    if (cleanup.userId) await prisma.user.delete({ where: { id: cleanup.userId } }).catch(() => {});
    cleanup.pinIds = [];
    cleanup.batchId = undefined;
    cleanup.userId = undefined;
  });

  it("allows only one sticker per pin", async () => {
    const batch = await prisma.stickerBatch.create({ data: { label: "test", quantity: 2 } });
    cleanup.batchId = batch.id;
    const pin = await prisma.pin.create({ data: {} });
    cleanup.pinIds.push(pin.id);

    await prisma.sticker.create({ data: { code: generateSlug(), batchId: batch.id, pinId: pin.id } });
    await expect(
      prisma.sticker.create({ data: { code: generateSlug(), batchId: batch.id, pinId: pin.id } })
    ).rejects.toMatchObject({ code: "P2002" });
  });

  it("never exposes a sticker code through the public directory", async () => {
    const batch = await prisma.stickerBatch.create({ data: { label: "test", quantity: 1 } });
    cleanup.batchId = batch.id;
    const user = await prisma.user.create({
      data: { id: randomUUID(), email: `u-${randomUUID()}@example.com`, username: `u_${randomUUID().slice(0, 8)}` },
    });
    cleanup.userId = user.id;

    const code = generateSlug();
    const marker = `leak-check-${randomUUID()}`;
    const pin = await prisma.pin.create({
      data: {
        sticker: { create: { code, batchId: batch.id, attachedAt: new Date() } },
        holdings: {
          create: {
            userId: user.id,
            acquiredAt: new Date(),
            acquiredVia: "BOUGHT",
            placeLabel: "Orlando, FL",
            lat: 28.5,
            lng: -81.4,
            title: { create: { title: marker } },
          },
        },
      },
    });
    cleanup.pinIds.push(pin.id);

    const { pins } = await loadDirectoryPage({ search: marker });
    expect(pins.map((p) => p.number)).toEqual([pin.number]);
    expect(JSON.stringify(pins)).not.toContain(code);
  });
});
