"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/auth";

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
  // Becomes Supabase's `redirect_to` — where the confirmation link sends
  // the browser after verification (see exchangeStrayAuthCode in
  // src/lib/supabase/proxy.ts for what happens on arrival).
  const destinationUrl = new URL(typeof next === "string" && next ? next : "/", process.env.NEXT_PUBLIC_APP_URL);

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data,
    options: {
      emailRedirectTo: destinationUrl.toString(),
    },
  });

  if (error) {
    console.error("signInWithOtp failed", { status: error.status, code: error.code, message: error.message });
    const message =
      error.code === "over_email_send_rate_limit"
        ? "You've requested a few of these already — wait about a minute and try again."
        : "Couldn't send that link — please try again.";
    return { status: "error", message };
  }
  return { status: "sent" };
}

export type PasswordSignInState = { status: "idle" | "error"; message?: string };

const passwordSignInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// Available once someone's set a password during onboarding — doesn't
// replace the magic link, just means they're not dependent on it every
// time, and aren't locked out if they lose access to this email address.
export async function signInWithPassword(
  _prevState: PasswordSignInState,
  formData: FormData
): Promise<PasswordSignInState> {
  const parsed = passwordSignInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { status: "error", message: "Enter your email and password." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return { status: "error", message: "Incorrect email or password." };
  }

  redirect(safeNext(formData.get("next")));
}
