"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/auth";
import { withTimeout, AUTH_CALL_TIMEOUT_MS } from "@/lib/with-timeout";

const TIMEOUT_MESSAGE = "This is taking longer than expected — please try again in a moment.";

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
  const result = await withTimeout(
    supabase.auth.signInWithOtp({
      email: parsed.data,
      options: {
        emailRedirectTo: destinationUrl.toString(),
      },
    }),
    AUTH_CALL_TIMEOUT_MS
  );

  if (result === "timeout") {
    console.error(`signInWithOtp timed out after ${AUTH_CALL_TIMEOUT_MS}ms`);
    return { status: "error", message: TIMEOUT_MESSAGE };
  }
  if (result.error) {
    console.error("signInWithOtp failed", {
      status: result.error.status,
      code: result.error.code,
      message: result.error.message,
    });
    const message =
      result.error.code === "over_email_send_rate_limit"
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
  const result = await withTimeout(supabase.auth.signInWithPassword(parsed.data), AUTH_CALL_TIMEOUT_MS);
  if (result === "timeout") {
    console.error(`signInWithPassword timed out after ${AUTH_CALL_TIMEOUT_MS}ms`);
    return { status: "error", message: TIMEOUT_MESSAGE };
  }
  if (result.error) {
    return { status: "error", message: "Incorrect email or password." };
  }

  redirect(safeNext(formData.get("next")));
}
