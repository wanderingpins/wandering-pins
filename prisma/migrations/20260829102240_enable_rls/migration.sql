-- Enable Row-Level Security on every public-schema table.
--
-- This app never queries these tables via Supabase's PostgREST API
-- (supabase-js is only used for .auth and .storage — see src/lib/supabase/
-- client.ts, server.ts, and src/lib/storage.ts). All real data access goes
-- through Prisma over a direct Postgres connection (DATABASE_URL), using the
-- `postgres` role, which bypasses RLS.
--
-- With RLS disabled (Supabase's default for new tables), every table here
-- was reachable by anyone with the project URL + publishable/anon key —
-- both public, shipped in the client bundle — directly against the REST API
-- (e.g. GET /rest/v1/holding_notes), completely bypassing this app's own
-- access control. Enabling RLS with zero policies below default-denies the
-- anon/authenticated PostgREST roles on every table while leaving Prisma's
-- direct connection and the admin/secret-key API untouched.
--
-- No policies are added because no legitimate PostgREST traffic exists to
-- preserve. If a future feature needs supabase-js table access, add a
-- specific policy for it then — don't remove this blanket enable.

ALTER TABLE "public"."sticker_batches" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."pins" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."pin_holdings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."holding_notes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."holding_photos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."pin_titles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."rate_limit_hits" ENABLE ROW LEVEL SECURITY;
