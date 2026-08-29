/*
  Warnings:

  - You are about to drop the column `series` on the `pins` table. All the data in the column will be lost.
  - You are about to drop the column `series_key` on the `pins` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "pins_series_key_idx";

-- AlterTable
ALTER TABLE "pins" DROP COLUMN "series",
DROP COLUMN "series_key";

-- CreateTable
CREATE TABLE "series" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "name_key" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "series_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "series_items" (
    "id" TEXT NOT NULL,
    "series_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "label_key" TEXT NOT NULL,
    "position" INTEGER,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "series_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "series_claims" (
    "id" TEXT NOT NULL,
    "series_item_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "linked_pin_id" TEXT,
    "claimed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "series_claims_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "series_name_key_key" ON "series"("name_key");

-- CreateIndex
CREATE UNIQUE INDEX "series_items_series_id_label_key_key" ON "series_items"("series_id", "label_key");

-- CreateIndex
CREATE INDEX "series_claims_user_id_idx" ON "series_claims"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "series_claims_series_item_id_user_id_key" ON "series_claims"("series_item_id", "user_id");

-- AddForeignKey
ALTER TABLE "series" ADD CONSTRAINT "series_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "series_items" ADD CONSTRAINT "series_items_series_id_fkey" FOREIGN KEY ("series_id") REFERENCES "series"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "series_items" ADD CONSTRAINT "series_items_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "series_claims" ADD CONSTRAINT "series_claims_series_item_id_fkey" FOREIGN KEY ("series_item_id") REFERENCES "series_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "series_claims" ADD CONSTRAINT "series_claims_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "series_claims" ADD CONSTRAINT "series_claims_linked_pin_id_fkey" FOREIGN KEY ("linked_pin_id") REFERENCES "pins"("id") ON DELETE SET NULL ON UPDATE CASCADE;
