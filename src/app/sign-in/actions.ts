"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const emailSchema = z.string().email();

export async function sendMagicLink(
  _prevState: { status: "idle" | "sent" | "error"; message?: string },
  formData: FormData
): Promise<{ status: "idle" | "sent" | "error"; message?: string }> {
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) {
    return { status: "error", message: "That doesn't look like a valid email address." };
  }

  const next = formData.get("next");
  // The Magic Link email template appends this as `&next=` on the
  // token_hash confirmation URL itself (via {{ .RedirectTo }}) — so this is
  // the final destination, not a URL to /auth/confirm.
  const destinationUrl = new URL(typeof next === "string" && next ? next : "/", process.env.NEXT_PUBLIC_APP_URL);

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data,
    options: {
      emailRedirectTo: destinationUrl.toString(),
    },
  });

  if (error) {
    console.error("signInWithOtp failed", { status: error.status, code: error.code, message: error.message, destinationUrl: destinationUrl.toString() });
    // TEMPORARY: showing Supabase's actual error (safe pre-launch, no real
    // users yet) instead of guessing blind between rate-limit / disallowed
    // redirect URL / outage. Tighten this back up before real traffic.
    return { status: "error", message: `${error.message} (code: ${error.code ?? "unknown"})` };
  }
  return { status: "sent" };
}
