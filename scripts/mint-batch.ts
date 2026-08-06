// Mints a sticker batch: N unique MINTED pins in the DB, plus a Version-1
// QR PNG per slug and a manifest CSV, ready to hand to a sticker printer.
// Usage: npx tsx --env-file=.env scripts/mint-batch.ts <label> <quantity> [outDir]
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { prisma } from "../src/lib/prisma";
import { generateSlug } from "../src/lib/slug";
import { generatePinQrPng } from "../src/lib/qr";

async function main() {
  const label = process.argv[2];
  const quantity = Number(process.argv[3]);
  const outDir = process.argv[4] ?? path.join(process.cwd(), "sticker-batches", label ?? "batch");

  if (!label || !Number.isInteger(quantity) || quantity <= 0) {
    console.error("Usage: mint-batch.ts <label> <quantity> [outDir]");
    process.exit(1);
  }

  mkdirSync(outDir, { recursive: true });

  const batch = await prisma.stickerBatch.create({ data: { label, quantity } });

  const rows: string[] = ["slug,filename"];
  for (let i = 0; i < quantity; i++) {
    let slug: string;
    // 32^6 keyspace makes a real collision astronomically unlikely, but
    // the unique constraint is the actual guarantee — retry on the rare hit.
    for (;;) {
      slug = generateSlug();
      try {
        await prisma.pin.create({ data: { slug, batchId: batch.id } });
        break;
      } catch (err) {
        if (err instanceof Error && err.message.includes("Unique constraint")) continue;
        throw err;
      }
    }

    const png = await generatePinQrPng(slug);
    const filename = `${slug}.png`;
    writeFileSync(path.join(outDir, filename), png);
    rows.push(`${slug},${filename}`);

    if ((i + 1) % 100 === 0 || i + 1 === quantity) {
      console.log(`${i + 1}/${quantity}`);
    }
  }

  writeFileSync(path.join(outDir, "manifest.csv"), rows.join("\n"));
  console.log(`Minted ${quantity} pins in batch "${label}" (${batch.id}) — output in ${outDir}`);
}

main().finally(() => prisma.$disconnect());
