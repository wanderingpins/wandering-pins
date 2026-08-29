-- AlterTable
ALTER TABLE "holding_check_ins" ADD COLUMN     "verified" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "pin_holdings" ADD COLUMN     "verified" BOOLEAN NOT NULL DEFAULT false;
