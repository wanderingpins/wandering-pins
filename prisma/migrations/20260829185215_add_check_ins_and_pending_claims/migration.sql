-- AlterTable
ALTER TABLE "pin_holdings" ADD COLUMN     "pending" BOOLEAN NOT NULL DEFAULT false;

-- A still-held pin can now be tentatively claimed by someone else before the
-- real holder releases it (product decision). Replaces the old
-- "pin_holdings_pin_id_open_key" partial unique index (one open holding per
-- pin, full stop) with two narrower ones, so a real open holding and one
-- pending claim can coexist without either invariant breaking:
DROP INDEX "pin_holdings_pin_id_open_key";

-- At most one CONFIRMED open holding per pin — this is "the current holder."
CREATE UNIQUE INDEX "pin_holdings_pin_id_open_confirmed_key" ON "pin_holdings" ("pin_id") WHERE "released_at" IS NULL AND "pending" = false;

-- At most one PENDING claim per pin at a time — the recommended, simpler
-- design over letting multiple people pre-claim simultaneously.
CREATE UNIQUE INDEX "pin_holdings_pin_id_pending_key" ON "pin_holdings" ("pin_id") WHERE "released_at" IS NULL AND "pending" = true;

-- CreateTable
CREATE TABLE "holding_check_ins" (
    "id" TEXT NOT NULL,
    "holding_id" TEXT NOT NULL,
    "logged_at" TIMESTAMP(3) NOT NULL,
    "place_label" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "holding_check_ins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "holding_check_in_notes" (
    "id" TEXT NOT NULL,
    "check_in_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "holding_check_in_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "holding_check_in_photos" (
    "id" TEXT NOT NULL,
    "check_in_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "holding_check_in_photos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "holding_check_ins_holding_id_idx" ON "holding_check_ins"("holding_id");

-- CreateIndex
CREATE UNIQUE INDEX "holding_check_in_notes_check_in_id_key" ON "holding_check_in_notes"("check_in_id");

-- CreateIndex
CREATE INDEX "holding_check_in_photos_check_in_id_idx" ON "holding_check_in_photos"("check_in_id");

-- AddForeignKey
ALTER TABLE "holding_check_ins" ADD CONSTRAINT "holding_check_ins_holding_id_fkey" FOREIGN KEY ("holding_id") REFERENCES "pin_holdings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "holding_check_in_notes" ADD CONSTRAINT "holding_check_in_notes_check_in_id_fkey" FOREIGN KEY ("check_in_id") REFERENCES "holding_check_ins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "holding_check_in_photos" ADD CONSTRAINT "holding_check_in_photos_check_in_id_fkey" FOREIGN KEY ("check_in_id") REFERENCES "holding_check_ins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Every new public-schema table needs RLS enabled the moment it's created
-- (see 20260829102240_enable_rls) — Supabase auto-exposes it via PostgREST
-- regardless of whether the app uses supabase-js for it, gated only by RLS.
-- No policies needed: there's no legitimate PostgREST traffic to preserve,
-- and Prisma's own `postgres` role bypasses RLS by default.
ALTER TABLE "holding_check_ins" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "holding_check_in_notes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "holding_check_in_photos" ENABLE ROW LEVEL SECURITY;
