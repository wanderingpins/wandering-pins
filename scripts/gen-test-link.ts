// Dev-only helper: mints a magic-link token via the Supabase admin API
// (secret key, from .env — never printed) so you can drive /auth/confirm
// directly without a real inbox round-trip. Not wired into the app; local
// use only. Usage: npx tsx --env-file=.env scripts/gen-test-link.ts [email]
import { createClient } from "@supabase/supabase-js";

const email = process.argv[2] ?? "test-agent@example.com";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);

async function main() {
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo: "http://localhost:3000/auth/confirm?next=/my-pins" },
  });
  if (error) {
    console.error(error);
    process.exit(1);
  }
  console.log(JSON.stringify(data.properties, null, 2));
}

main();
