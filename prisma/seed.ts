// Minimal dev-only seed: one sticker batch, one registered pin with a
// three-city journey, matching the brief's worked example (section
// "Appendix — worked example"). Run with: node prisma/seed.ts
import { randomUUID } from "node:crypto";
import { prisma } from "../src/lib/prisma";
import { generateSlug } from "../src/lib/slug";

async function main() {
  const batch = await prisma.stickerBatch.create({
    data: { label: "dev-seed", quantity: 1 },
  });

  const slug = generateSlug();

  // These are demo users, not real Supabase Auth accounts — id is normally
  // the Supabase auth UUID (see schema comment on User.id), so we mint a
  // random one here just to have something id-shaped.
  const tim = await prisma.user.upsert({
    where: { email: "tim@example.com" },
    update: {},
    create: { id: randomUUID(), email: "tim@example.com", displayName: "Tim" },
  });
  const sarah = await prisma.user.upsert({
    where: { email: "sarah@example.com" },
    update: {},
    create: { id: randomUUID(), email: "sarah@example.com", displayName: "Sarah" },
  });
  const kenji = await prisma.user.upsert({
    where: { email: "kenji@example.com" },
    update: {},
    create: {
      id: randomUUID(),
      email: "kenji@example.com",
      displayName: "Kenji",
      showNamePublicly: false,
    },
  });

  const pin = await prisma.pin.create({
    data: {
      slug,
      batchId: batch.id,
      status: "REGISTERED",
      registeredAt: new Date("2024-03-01T00:00:00Z"),
      holdings: {
        create: [
          {
            userId: tim.id,
            acquiredAt: new Date("2024-03-01T00:00:00Z"),
            acquiredVia: "BOUGHT",
            placeLabel: "Orlando, FL",
            lat: 28.5383,
            lng: -81.3792,
            releasedAt: new Date("2024-06-01T00:00:00Z"),
          },
          {
            userId: sarah.id,
            acquiredAt: new Date("2024-06-01T00:00:00Z"),
            acquiredVia: "TRADED",
            placeLabel: "Denver, CO",
            lat: 39.7392,
            lng: -104.9903,
            releasedAt: new Date("2024-11-01T00:00:00Z"),
          },
          {
            userId: kenji.id,
            acquiredAt: new Date("2024-11-01T00:00:00Z"),
            acquiredVia: "TRADED",
            placeLabel: "Osaka, Japan",
            lat: 34.6937,
            lng: 135.5023,
          },
        ],
      },
    },
  });

  console.log(`Seeded pin ${pin.slug} — view at /p/${pin.slug}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
