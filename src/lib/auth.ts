import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import type { User } from "@/generated/prisma/client";

// getClaims() validates the JWT locally against the project's published
// keys — safe to trust for authorization, unlike getSession(). Returns null
// if there's no signed-in user.
export async function getAuthClaims() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return data?.claims ?? null;
}

// Supabase Auth and our own `users` table are separate systems sharing one
// id (the Supabase auth UUID — see schema comment on User.id). This lazily
// creates the row on first sign-in rather than wiring a DB trigger across
// schemas, since it's just as correct and stays in application code.
export async function getOrCreateAppUser(): Promise<User | null> {
  const claims = await getAuthClaims();
  if (!claims?.sub || !claims.email) return null;

  return prisma.user.upsert({
    where: { id: claims.sub },
    update: {},
    create: {
      id: claims.sub,
      email: claims.email,
      displayName: claims.email.split("@")[0],
    },
  });
}

// For Server Components/Actions that require a signed-in user. Sends
// anonymous visitors to sign in and back to where they were headed.
export async function requireAppUser(nextPath: string): Promise<User> {
  const user = await getOrCreateAppUser();
  if (!user) {
    redirect(`/sign-in?next=${encodeURIComponent(nextPath)}`);
  }
  return user;
}
