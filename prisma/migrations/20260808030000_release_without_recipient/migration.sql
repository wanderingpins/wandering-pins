-- Addressed trades (email/username-addressed, two-sided claim/release) are
-- retired in favor of one-sided, unaddressed release (brief section 6.4):
-- the current holder just releases with no recipient specified, and whoever
-- later finds the pin registers a fresh holding for themselves. Zero real
-- Trade rows ever existed in production, so the table is dropped outright.
-- DropForeignKey
ALTER TABLE "trades" DROP CONSTRAINT "trades_from_user_id_fkey";

-- DropForeignKey
ALTER TABLE "trades" DROP CONSTRAINT "trades_holding_id_fkey";

-- DropForeignKey
ALTER TABLE "trades" DROP CONSTRAINT "trades_pin_id_fkey";

-- DropForeignKey
ALTER TABLE "trades" DROP CONSTRAINT "trades_to_user_id_fkey";

-- AlterTable
ALTER TABLE "holding_notes" ADD COLUMN     "release_date" TIMESTAMP(3),
ADD COLUMN     "release_place_label" TEXT;

-- DropTable
DROP TABLE "trades";

-- DropEnum
DROP TYPE "TradeStatus";

-- CreateIndex
-- Restores the partial unique index dropped in
-- 20260808013534_decouple_trade_claim_release. That drop supported two
-- simultaneously open holdings while a trade was mid-flight; the new model
-- never creates two opens at once (release is atomic and instant, claim is
-- a separate later event with a gap, not an overlap), so the invariant
-- holds again — and this closes a real pre-existing race in registerPin,
-- where two people simultaneously registering the same never-claimed pin
-- could both succeed.
CREATE UNIQUE INDEX "pin_holdings_pin_id_open_key" ON "pin_holdings" ("pin_id") WHERE "released_at" IS NULL;
