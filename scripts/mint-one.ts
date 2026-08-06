import { prisma } from "../src/lib/prisma";
import { generateSlug } from "../src/lib/slug";

async function main() {
  const batch = await prisma.stickerBatch.create({ data: { label: "test-mint", quantity: 1 } });
  const slug = generateSlug();
  await prisma.pin.create({ data: { slug, batchId: batch.id } });
  console.log(slug);
}
main().finally(() => prisma.$disconnect());
