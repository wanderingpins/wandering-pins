"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAppUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { usernameSchema } from "@/lib/username";
import { Prisma } from "@/generated/prisma/client";
import { setPlaceRegionOnly } from "@/lib/place-privacy";

export type ActionState = { status: "idle" | "ok" | "error"; message?: string };

const profileSchema = z.object({
  username: usernameSchema,
  firstName: z.string().trim().max(100).optional(),
  lastName: z.string().trim().max(100).optional(),
  city: z.string().trim().max(100).optional(),
});

export async function updateProfile(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireAppUser("/settings");

  const parsed = profileSchema.safeParse({
    username: formData.get("username"),
    firstName: formData.get("firstName") || undefined,
    lastName: formData.get("lastName") || undefined,
    city: formData.get("city") || undefined,
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Please check your answers." };
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
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { status: "error", message: "That username's taken — try another." };
    }
    throw error;
  }

  revalidatePath("/settings");
  return { status: "ok" };
}

const emailSchema = z.object({ email: z.string().email() });

export type EmailChangeState = { status: "idle" | "pending" | "error"; message?: string };

// Supabase emails a confirmation link to the *new* address; auth.users.email
// (and, via getOrCreateAppUser's sync on the next request, public.users.email)
// only actually changes once that link is clicked — nothing here is instant.
// The same Supabase Auth UUID is kept throughout, which is what keeps this
// user's PinHolding rows attached (brief section 6.2) — unlike just signing
// in again with a different email, which mints an unrelated new account.
export async function requestEmailChange(
  _prevState: EmailChangeState,
  formData: FormData
): Promise<EmailChangeState> {
  await requireAppUser("/settings");

  const parsed = emailSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { status: "error", message: "That doesn't look like a valid email address." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ email: parsed.data.email });
  if (error) {
    console.error("updateUser(email) failed", { status: error.status, code: error.code, message: error.message });
    const message =
      error.code === "email_exists"
        ? "That email is already in use by another account."
        : "Couldn't start that email change — please try again.";
    return { status: "error", message };
  }

  return { status: "pending", message: parsed.data.email };
}

// "Always show my places as the state" (User.placesRegionOnly). Turning it on
// also switches every place you've already logged, since that's what
// "always" promises; turning it off only changes the default for new places —
// showing a town you'd hidden is left as a deliberate, per-place choice on
// that pin's privacy section.
export async function setPlacesRegionOnly(on: boolean): Promise<ActionState> {
  const user = await requireAppUser("/settings");
  await prisma.user.update({ where: { id: user.id }, data: { placesRegionOnly: on } });

  if (on) {
    const placeFields = { id: true, lat: true, lng: true, regionLabel: true, regionLat: true, regionLng: true } as const;
    const [holdings, checkIns] = await Promise.all([
      prisma.pinHolding.findMany({ where: { userId: user.id, regionOnly: false }, select: placeFields }),
      prisma.holdingCheckIn.findMany({ where: { holding: { userId: user.id }, regionOnly: false }, select: placeFields }),
    ]);
    const cache = new Map();
    let failed = 0;
    for (const h of holdings) if (!(await setPlaceRegionOnly("holding", h, true, cache))) failed++;
    for (const c of checkIns) if (!(await setPlaceRegionOnly("checkin", c, true, cache))) failed++;
    revalidatePath("/", "layout");
    if (failed > 0) {
      return {
        status: "error",
        message: `${failed} of your places couldn't be switched just now — switch this off and on again to retry.`,
      };
    }
  }

  revalidatePath("/settings");
  return { status: "ok" };
}
