// Races a promise against a timer so a hung network call fails fast instead
// of leaving whoever's awaiting it stuck forever. Resolves to the literal
// string "timeout" rather than rejecting, so callers can branch with a
// simple equality check instead of try/catch — the original promise keeps
// running in the background if it does eventually settle, but nothing here
// awaits that anymore.
export async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | "timeout"> {
  return Promise.race([
    promise,
    new Promise<"timeout">((resolve) => setTimeout(() => resolve("timeout"), ms)),
  ]);
}

// For a foreground call the user is actively waiting on (a sign-in button,
// a confirmation link) — long enough that a normal-but-slow network doesn't
// false-positive, short enough that a degraded Supabase Auth API (observed
// hanging 30+s during a real incident) fails as an error instead of a hang.
// Deliberately longer than the middleware's own 3s getClaims timeout in
// src/lib/supabase/proxy.ts, which can afford to be stricter because it
// fails silently (skip one background refresh) rather than surfacing an
// error to the person waiting on it.
export const AUTH_CALL_TIMEOUT_MS = 8000;
