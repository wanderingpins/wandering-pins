-- CreateEnum
CREATE TYPE "PinStatus" AS ENUM ('MINTED', 'REGISTERED');

-- CreateEnum
CREATE TYPE "AcquiredVia" AS ENUM ('BOUGHT', 'TRADED', 'GIFT', 'FOUND', 'OTHER');

-- CreateEnum
CREATE TYPE "TradeStatus" AS ENUM ('PENDING', 'CONFIRMED', 'DECLINED');

-- CreateEnum
CREATE TYPE "PhotoKind" AS ENUM ('FRONT', 'BACK', 'OTHER');

-- CreateTable
CREATE TABLE "sticker_batches" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "label" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "sticker_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pins" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "PinStatus" NOT NULL DEFAULT 'MINTED',
    "batch_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "registered_at" TIMESTAMP(3),

    CONSTRAINT "pins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "show_name_publicly" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pin_holdings" (
    "id" TEXT NOT NULL,
    "pin_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "acquired_at" TIMESTAMP(3) NOT NULL,
    "acquired_via" "AcquiredVia" NOT NULL,
    "place_label" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "released_at" TIMESTAMP(3),

    CONSTRAINT "pin_holdings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "holding_notes" (
    "id" TEXT NOT NULL,
    "holding_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "holding_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "holding_photos" (
    "id" TEXT NOT NULL,
    "holding_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "kind" "PhotoKind" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "holding_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pin_titles" (
    "id" TEXT NOT NULL,
    "holding_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,

    CONSTRAINT "pin_titles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trades" (
    "id" TEXT NOT NULL,
    "pin_id" TEXT NOT NULL,
    "from_user_id" TEXT NOT NULL,
    "to_user_id" TEXT,
    "to_email" TEXT,
    "status" "TradeStatus" NOT NULL DEFAULT 'PENDING',
    "proposed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),
    "place_label" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,

    CONSTRAINT "trades_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pins_slug_key" ON "pins"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "pin_holdings_pin_id_idx" ON "pin_holdings"("pin_id");

-- CreateIndex
CREATE INDEX "pin_holdings_user_id_idx" ON "pin_holdings"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "holding_notes_holding_id_key" ON "holding_notes"("holding_id");

-- CreateIndex
CREATE INDEX "holding_photos_holding_id_idx" ON "holding_photos"("holding_id");

-- CreateIndex
CREATE UNIQUE INDEX "pin_titles_holding_id_key" ON "pin_titles"("holding_id");

-- CreateIndex
CREATE INDEX "trades_pin_id_idx" ON "trades"("pin_id");

-- CreateIndex
CREATE INDEX "trades_to_email_idx" ON "trades"("to_email");

-- AddForeignKey
ALTER TABLE "pins" ADD CONSTRAINT "pins_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "sticker_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pin_holdings" ADD CONSTRAINT "pin_holdings_pin_id_fkey" FOREIGN KEY ("pin_id") REFERENCES "pins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pin_holdings" ADD CONSTRAINT "pin_holdings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "holding_notes" ADD CONSTRAINT "holding_notes_holding_id_fkey" FOREIGN KEY ("holding_id") REFERENCES "pin_holdings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "holding_photos" ADD CONSTRAINT "holding_photos_holding_id_fkey" FOREIGN KEY ("holding_id") REFERENCES "pin_holdings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pin_titles" ADD CONSTRAINT "pin_titles_holding_id_fkey" FOREIGN KEY ("holding_id") REFERENCES "pin_holdings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trades" ADD CONSTRAINT "trades_pin_id_fkey" FOREIGN KEY ("pin_id") REFERENCES "pins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trades" ADD CONSTRAINT "trades_from_user_id_fkey" FOREIGN KEY ("from_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trades" ADD CONSTRAINT "trades_to_user_id_fkey" FOREIGN KEY ("to_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
