# Wandering Pins — handoff notes

Status as of 2026-08-07: v1 built per WANDERING_PINS_BRIEF.md, deployed, and live at wanderingpins.com. A new Claude Code session opened in this folder should read this file first, then the brief.

## Live setup

- **Repo**: github.com/wanderingpins/wandering-pins, `main` auto-deploys to Vercel.
- **Domains**: `www.wanderingpins.com` is canonical for the app (bare domain 308s into it — low-stakes, nothing printed with that exact URL). `wpins.co`/`www.wpins.co` need **`www.wpins.co` set as primary in Vercel** (bare `wpins.co` redirecting into it) — this is the OPPOSITE of an earlier fix and is due to a QR-format change (see Deviations below). Check with `curl -sI https://www.wpins.co/ANYCODE` — should be a direct 302 to wanderingpins.com, not a 308 first.
- **Accounts involved**: Supabase (DB + auth + storage), Resend (transactional email via Supabase SMTP settings, not in this app's own config), MapTiler (map tiles + geocoding). All credentials live in Vercel's env vars and Supabase's dashboard — see `.env.example` for the full list of what's needed and where each value comes from.
- **Database**: real production data lives in Supabase now — no separate dev/staging DB. Be careful with destructive scripts.

## Deviations from the original brief

The brief got some things right in principle but wrong in a couple of real-world specifics, corrected after live device testing:

1. **QR now encodes `WWW.WPINS.CO/{code}`, not `WPINS.CO/{code}`.** The brief's "no www" spec assumed all phone cameras recognize a bare schemeless domain as a link — confirmed on a real Android/Pixel default Camera app that this is false; it fell back to a failed Google search instead of opening a link. Fixed by adding `WWW.` and dropping to ECC level M (still Version 1, same physical/module size, zero slack). See `src/lib/qr.ts` comments. The printed fallback text on the sticker itself still reads "WPINS.CO" (no www) since a human typing it manually doesn't need the prefix.
2. **Geocoding filters `types=place,municipality,county,locality`, not just `place`.** MapTiler tags US "consolidated city-county" places (Denver, San Francisco, Nashville, ...) as `county` — filtering to `place` alone silently matched an unrelated same-named place elsewhere in the world instead of the real city. See `src/lib/geocode.ts` and its test.
3. **MapLibre GL needs a self-hosted worker script** (`scripts/copy-maplibre-worker.mjs`, runs on postinstall) — its own `import.meta.url`-based worker auto-detection silently fails under this Next.js version, and the map would otherwise never render with no error anywhere. See `src/lib/map-config.ts`.
4. **Auth confirmation**: Supabase's actual default Magic Link template routes through its own `/auth/v1/verify`, landing the PKCE code on the Auth "Site URL" (the homepage) rather than a dedicated `/auth/confirm` route — regardless of a dashboard template edit intended to change that (that edit didn't take effect). Handled defensively in `src/lib/supabase/proxy.ts`'s `exchangeStrayAuthCode`, which catches a stray `code`/`error` on any path.

## Useful scripts

- `node scripts/mint-batch.ts <label> <quantity> [outDir]` — mint N real pins + QR PNGs + manifest.
- `node scripts/make-sticker-sheet.mjs <batchDir>` — true-size printable PDF proof sheet from a mint-batch output dir. Must print at 100%/actual size.
- `npx tsx --env-file=.env scripts/gen-test-link.ts [email]` — mint a real Supabase session token via the admin API, for testing auth-gated flows without an inbox round-trip.

## Known open items (not urgent)

- One user's real inbox (a Microsoft 365 address) never received a sign-in email despite Resend reporting successful delivery — likely a recipient-side mail-flow/quarantine issue, not something in this app.
- The low-stakes `wanderingpins.com` → `www.wanderingpins.com` 308 (see Domains above) could be tidied later if desired.

## Test coverage

49+ vitest tests (`npm test`), mix of pure-logic and live-integration (hits the real Supabase DB and MapTiler API — needs `.env` populated). `npx tsc --noEmit` and `npx eslint .` should both be clean before committing.
