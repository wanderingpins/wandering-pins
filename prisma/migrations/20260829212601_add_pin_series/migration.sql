-- AlterTable
ALTER TABLE "pins" ADD COLUMN     "series" TEXT,
ADD COLUMN     "series_key" TEXT;

-- CreateIndex
CREATE INDEX "pins_series_key_idx" ON "pins"("series_key");
