-- Pin privacy, "only show the state" places, and blind-box pictures on series
-- (see PinHolding, HoldingCheckIn, User and Series in schema.prisma).
-- Additive only: new columns with defaults or NULL, no backfill. The code that
-- ships with this reads the new columns, so run this in the Supabase SQL editor
-- BEFORE that code deploys (the old code ignores them, so running it early is
-- harmless).

-- Settings: "Always show my places as the state".
ALTER TABLE "users" ADD COLUMN "places_region_only" BOOLEAN NOT NULL DEFAULT false;

-- A holder's own stretch of a pin's journey can be private, and each place can
-- be shown publicly as just its state/region.
ALTER TABLE "pin_holdings" ADD COLUMN "is_private" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "pin_holdings" ADD COLUMN "region_only" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "pin_holdings" ADD COLUMN "region_label" TEXT;
ALTER TABLE "pin_holdings" ADD COLUMN "region_lat" DOUBLE PRECISION;
ALTER TABLE "pin_holdings" ADD COLUMN "region_lng" DOUBLE PRECISION;

ALTER TABLE "holding_check_ins" ADD COLUMN "region_only" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "holding_check_ins" ADD COLUMN "region_label" TEXT;
ALTER TABLE "holding_check_ins" ADD COLUMN "region_lat" DOUBLE PRECISION;
ALTER TABLE "holding_check_ins" ADD COLUMN "region_lng" DOUBLE PRECISION;

-- A picture of the unopened blind box, one per series.
ALTER TABLE "series" ADD COLUMN "box_image_path" TEXT;
ALTER TABLE "series" ADD COLUMN "box_image_by" TEXT;
ALTER TABLE "series" ADD COLUMN "box_image_added_at" TIMESTAMP(3);

-- "Tell the story" (holding_notes.body) can be shared on the pin's page by its
-- writer, while it's their current holding. Off by default.
ALTER TABLE "holding_notes" ADD COLUMN "is_public" BOOLEAN NOT NULL DEFAULT false;
