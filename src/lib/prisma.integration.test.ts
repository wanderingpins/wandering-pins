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
    const slug = generateSlug();
    const pin = await prisma.pin.create({
      data: { slug, batchId: batch.id },
    });

    const found = await prisma.pin.findUnique({ where: { slug } });
    expect(found?.status).toBe("MINTED");

    await prisma.pin.delete({ where: { id: pin.id } });
    await prisma.stickerBatch.delete({ where: { id: batch.id } });
  });
});
