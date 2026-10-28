import { describe, expect, it } from "vitest";
import { prisma } from "./prisma";
import { generateSlug } from "./slug";

// Exercises the real runtime path (PrismaPg driver adapter over the pooled
// Supabase connection) rather than just the pure logic — confirms the DB
// wiring itself, not just the schema.
describe("prisma runtime connection", () => {
  it("can write and read through the pooled connection", async () => {
    const batch = await prisma.stickerBatch.create({
      data: { label: "integration-test", quantity: 1 },
    });
    const code = generateSlug();
    const sticker = await prisma.sticker.create({
      data: { code, batchId: batch.id },
    });

    const found = await prisma.sticker.findUnique({ where: { code } });
    expect(found?.pinId).toBeNull();

    await prisma.sticker.delete({ where: { id: sticker.id } });
    await prisma.stickerBatch.delete({ where: { id: batch.id } });
  });
});
