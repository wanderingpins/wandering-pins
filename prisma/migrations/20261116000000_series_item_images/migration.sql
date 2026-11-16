-- Reference images on series checklist items (see SeriesItem in schema.prisma).
-- Additive only: three nullable columns, no backfill. The code that ships with
-- this reads the new columns, so run this in the Supabase SQL editor BEFORE that
-- code deploys (the old code ignores them, so running it early is harmless).
ALTER TABLE "series_items" ADD COLUMN "image_path" TEXT;
ALTER TABLE "series_items" ADD COLUMN "image_by" TEXT;
ALTER TABLE "series_items" ADD COLUMN "image_added_at" TIMESTAMP(3);
