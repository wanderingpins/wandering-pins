-- At most one open holding per pin (brief section 5): a pin can only be in
-- one person's hands at a time. Prisma's schema DSL has no WHERE clause for
-- @@unique, so this partial index is hand-written.
CREATE UNIQUE INDEX "pin_holdings_pin_id_open_key" ON "pin_holdings" ("pin_id") WHERE "released_at" IS NULL;
