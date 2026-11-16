import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import type { User } from "@/generated/prisma/client";
import { withTimeout } from "@/lib/with-timeout";

// getClaims() validates the JWT locally against the project's published
// keys — safe to trust for authorization, unlike getSession(). Returns null
// if there's no signed-in user.
//
// `timeoutMs` is opt-in and omitted by default, so requireAppUser's own use
// below (real access-control gating a protected page) keeps its original,
// deliberately-untimed behavior. Pass BEST_EFFORT_AUTH_TIMEOUT_MS
// (src/lib/with-timeout.ts) from a read-only call site instead — see that
// constant's comment for which call sites qualify and why this one doesn't.
export async function getAuthClaims(timeoutMs?: number) {
  const supabase = await createClient();
  const call = supabase.auth.getClaims();
  const result = timeoutMs === undefined ? await call : await withTimeout(call, timeoutMs);
  if (result === "timeout") {
    console.error(`getAuthClaims timed out after ${timeoutMs}ms`);
    return null;
  }
  const { data, error } = result;
  if (error) {
    console.error("getClaims failed", { message: error.message, code: (error as { code?: string }).code });
  }
  return data?.claims ?? null;
}

// Supabase Auth and our own `users` table are separate systems sharing one
// id (the Supabase auth UUID — see schema comment on User.id). This lazily
// creates the row on first sign-in rather than wiring a DB trigger across
// schemas, since it's just as correct and stays in application code.
//
// The update clause also keeps email in sync on every subsequent call — this
// is the whole mechanism behind "change your email without losing your
// collection": once a real Supabase email change is confirmed (same UUID,
// new auth email), the very next authenticated request syncs this row to
// match, with no separate code path to keep in sync with /auth/confirm.
export async function getOrCreateAppUser(): Promise<User | null> {
  const claims = await getAuthClaims();
  if (!claims?.sub || !claims.email) return null;

  return prisma.user.upsert({
    where: { id: claims.sub },
    update: { email: claims.email },
    create: {
      id: claims.sub,
      email: claims.email,
    },
  });
}

// For Server Components/Actions that require a signed-in user. Sends
// anonymous visitors to sign in, and anyone who hasn't picked a username yet
// to onboard, both back to where they were headed.
export async function requireAppUser(nextPath: string): Promise<User> {
  const user = await getOrCreateAppUser();
  if (!user) {
    redirect(`/sign-in?next=${encodeURIComponent(nextPath)}`);
  }
  if (!user.username) {
    redirect(`/onboarding?next=${encodeURIComponent(nextPath)}`);
  }
  return user;
}

// Site admins are listed by sign-in email in the ADMIN_EMAILS env var
// (comma-separated, set in Vercel), not in the database: nobody can make
// themselves an admin through the app, and adding or removing one is an env
// change plus a redeploy. Unset = nobody is an admin.
export function isAdminEmail(email: unknown): boolean {
  if (typeof email !== "string" || !email) return false;
  const admins = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return admins.includes(email.toLowerCase());
}

// For the /admin pages and every admin server action — checked again inside
// each action, since a server action can be called without loading the page.
// Anyone else gets a plain 404, so the page doesn't advertise itself.
export async function requireAdmin(): Promise<User> {
  const user = await requireAppUser("/admin");
  if (!isAdminEmail(user.email)) notFound();
  return user;
}

// A same-origin relative path is the only safe redirect target for a `next`
// value carried through a form field or query param — anything else (an
// absolute URL, a protocol-relative "//evil.com") could send someone off
// this site right after they authenticate.
export function safeNext(next: FormDataEntryValue | string | null | undefined): string {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}
