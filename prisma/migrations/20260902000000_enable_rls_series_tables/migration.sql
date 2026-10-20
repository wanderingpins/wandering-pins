-- The 20260829215220_add_series_tracking migration added these three tables
-- without enabling RLS, missing the rule set in 20260829102240_enable_rls:
-- every new public-schema table needs RLS enabled the moment it's created,
-- since Supabase auto-exposes it via PostgREST regardless of whether the app
-- uses supabase-js for it, gated only by RLS. Supabase's security advisor
-- flagged "series" as publicly readable/writable via the anon key as a
-- result. No policies needed: there's no legitimate PostgREST traffic to
-- preserve, and Prisma's own `postgres` role bypasses RLS by default.
ALTER TABLE "public"."series" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."series_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."series_claims" ENABLE ROW LEVEL SECURITY;
