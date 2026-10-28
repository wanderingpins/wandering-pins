-- Splits the sticker (the wander credential) out of the pin (the owned object).
--
-- Before: pins.slug was the printed QR code AND the public URL key AND the
-- claim key, and every pin had to be minted with a sticker first.
-- After:  stickers.code is the printed code (never public); pins.number is a
-- sequential public ID; a pin can exist with no sticker and a sticker with no
-- pin (minted, not yet used).
--
-- Written by hand because the backfill matters and `migrate diff` can't
-- generate one. Run in the Supabase SQL editor, then
-- `npx prisma migrate resolve --applied 20261028000000_split_sticker_from_pin`
-- (see HANDOFF.md Deviations #5).

-- 1. The new table.
CREATE TABLE "stickers" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "batch_id" TEXT NOT NULL,
    "pin_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attached_at" TIMESTAMP(3),

    CONSTRAINT "stickers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "stickers_code_key" ON "stickers"("code");
CREATE UNIQUE INDEX "stickers_pin_id_key" ON "stickers"("pin_id");

ALTER TABLE "stickers" ADD CONSTRAINT "stickers_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "sticker_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stickers" ADD CONSTRAINT "stickers_pin_id_fkey" FOREIGN KEY ("pin_id") REFERENCES "pins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Same rule as every other public-schema table (see 20260829102240_enable_rls):
-- RLS on, no policies — Prisma's postgres role bypasses it, PostgREST gets nothing.
ALTER TABLE "public"."stickers" ENABLE ROW LEVEL SECURITY;

-- 2. Backfill: every existing pin's slug becomes a sticker. Registered pins
--    keep their link; never-claimed (MINTED) pins become unattached stickers.
INSERT INTO "stickers" ("id", "code", "batch_id", "pin_id", "created_at", "attached_at")
SELECT
    gen_random_uuid()::text,
    "slug",
    "batch_id",
    CASE WHEN "status" = 'REGISTERED' THEN "id" END,
    "created_at",
    "registered_at"
FROM "pins";

-- 3. A MINTED pin was only ever a placeholder for its sticker. Nothing can
--    reference one (no holdings, no series claims) — the sticker row above
--    now carries it.
DELETE FROM "pins" WHERE "status" = 'MINTED';

-- 4. A pin's created_at now means when it was registered.
UPDATE "pins" SET "created_at" = "registered_at" WHERE "registered_at" IS NOT NULL;

-- 5. The public ID.
ALTER TABLE "pins" ADD COLUMN "number" SERIAL NOT NULL;
CREATE UNIQUE INDEX "pins_number_key" ON "pins"("number");

-- 6. Drop what moved to stickers.
ALTER TABLE "pins" DROP CONSTRAINT "pins_batch_id_fkey";
ALTER TABLE "pins" DROP COLUMN "slug";
ALTER TABLE "pins" DROP COLUMN "status";
ALTER TABLE "pins" DROP COLUMN "batch_id";
ALTER TABLE "pins" DROP COLUMN "registered_at";
DROP TYPE "PinStatus";
