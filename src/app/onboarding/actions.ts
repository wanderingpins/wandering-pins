"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getOrCreateAppUser, safeNext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { usernameSchema } from "@/lib/username";
import { Prisma } from "@/generated/prisma/client";

export type OnboardingState = { status: "idle" | "error"; message?: string };

const onboardingSchema = z
  .object({
    username: usernameSchema,
    password: z.string().min(8, "At least 8 characters"),
    confirmPassword: z.string(),
    firstName: z.string().trim().max(100).optional(),
    lastName: z.string().trim().max(100).optional(),
    city: z.string().trim().max(100).optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

// Runs once, right after a user's first magic-link sign-in — requireAppUser
// (src/lib/auth.ts) redirects anyone with no username here before letting
// them reach any protected page. Sets a password (so the account doesn't
// depend on continued access to this one inbox — brief section 6.2) and the
// profile fields in the same submit.
export async function completeOnboarding(_prevState: OnboardingState, formData: FormData): Promise<OnboardingState> {
  const user = await getOrCreateAppUser();
  if (!user) redirect("/sign-in");

  const parsed = onboardingSchema.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
    firstName: formData.get("firstName") || undefined,
    lastName: formData.get("lastName") || undefined,
    city: formData.get("city") || undefined,
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Please check your answers." };
  }

  const supabase = await createClient();
  const { error: passwordError } = await supabase.auth.updateUser({ password: parsed.data.password });
  // "same_password" fires on a retry after a username collision, if they
  // resubmit with the password they already successfully set the first
  // time — the end state they want (this password, set) already holds, so
  // it isn't a real failure. Any other error is.
  if (passwordError && passwordError.code !== "same_password") {
    console.error("updateUser(password) failed", { code: passwordError.code, message: passwordError.message });
    return { status: "error", message: "Couldn't set your password — please try again." };
  }

  try {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        username: parsed.data.username,
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        city: parsed.data.city,
      },
    });
  } catch (error) {
    // Caught here, not pre-checked with a findUnique first — a pre-check
    // has the same TOCTOU race two people picking the same username at once
    // would hit; the DB's unique constraint is the actual guarantee.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { status: "error", message: "That username's taken — try another." };
    }
    throw error;
  }

  redirect(safeNext(formData.get("next")));
}
