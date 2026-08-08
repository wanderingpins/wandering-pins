-- DropIndex
-- Claiming and releasing are now independent one-sided actions (brief
-- section 6.4) instead of one atomic two-sided confirmation, so a pin can
-- legitimately have more than one open holding at once for a while.
DROP INDEX IF EXISTS "pin_holdings_pin_id_open_key";

-- AlterTable
ALTER TABLE "trades" ADD COLUMN     "claimed_at" TIMESTAMP(3),
ADD COLUMN     "giver_released_at" TIMESTAMP(3),
ADD COLUMN     "holding_id" TEXT;

-- CreateIndex
CREATE INDEX "trades_holding_id_idx" ON "trades"("holding_id");

-- AddForeignKey
ALTER TABLE "trades" ADD CONSTRAINT "trades_holding_id_fkey" FOREIGN KEY ("holding_id") REFERENCES "pin_holdings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
