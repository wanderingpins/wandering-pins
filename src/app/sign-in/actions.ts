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
  const confirmUrl = new URL("/auth/confirm", process.env.NEXT_PUBLIC_APP_URL);
  if (typeof next === "string" && next) {
    confirmUrl.searchParams.set("next", next);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data,
    options: {
      emailRedirectTo: confirmUrl.toString(),
    },
  });

  if (error) {
    return { status: "error", message: "Couldn't send that link — please try again." };
  }
  return { status: "sent" };
}
