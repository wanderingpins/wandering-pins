-- Supabase's security advisor (rls_disabled_in_public) flagged Prisma's own
-- bookkeeping table, which lives in the public schema and is therefore exposed
-- via PostgREST to anyone with the project URL + anon key. Same reasoning as
-- 20260829102240_enable_rls: no policies, because there's no legitimate
-- PostgREST traffic, and Prisma's `postgres` role bypasses RLS, so
-- `prisma migrate` keeps working.
ALTER TABLE "public"."_prisma_migrations" ENABLE ROW LEVEL SECURITY;
