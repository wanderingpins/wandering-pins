-- AlterTable
-- display_name was auto-generated from the email prefix and never chosen or
-- edited (brief section 6.2) — superseded by username, which people pick
-- themselves during onboarding. username is nullable so existing accounts
-- can sit at NULL until they're onboarded (requireAppUser in src/lib/auth.ts
-- redirects them to /onboarding on their next visit); firstName/lastName/city
-- are private, never rendered on any public page (brief section 7).
ALTER TABLE "users" DROP COLUMN "display_name",
ADD COLUMN     "city" TEXT,
ADD COLUMN     "first_name" TEXT,
ADD COLUMN     "last_name" TEXT,
ADD COLUMN     "username" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");
