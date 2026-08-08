# Wandering Pins — build brief

A spec for building the first version of Wandering Pins. Written to be read by a coding agent
before writing any code. Read it end to end first; several decisions later in the document
constrain choices you'd otherwise make early.

---

## 1. What this is

Collectors of enamel lapel pins trade them constantly. Wandering Pins gives each physical pin a
permanent identity so its owner can pull it up instantly, and so everyone who has ever held it can
watch where it has travelled.

A small sticker on the back of the pin carries a QR code and a short human-readable code. Scanning
or typing that code opens the pin's public page: the chain of hands it has passed through, and where
in the world it has been.

**The delight is the journey.** A map and timeline showing that a pin went from Orlando to Denver to
Osaka is the product. Everything else is plumbing.

There are two distinct audiences, and they see different things:

- **Anyone at all**, including people who have never heard of this, can scan a pin and see its
  journey. No account needed. This is the whole acquisition funnel.
- **Signed-in collectors** additionally get their own history — every pin they have ever held, not
  just what they own now — plus private notes and private photos that nobody else can see.

### What this is explicitly NOT

This is not an authenticity, provenance, or anti-counterfeiting system. The sticker is removable and
transferable by design, and that is fine. Nothing in the product should claim or imply that a code
proves a pin is genuine.

This matters for implementation: do not build verification badges, "certified authentic" language,
tamper detection, or trust scores. Do not write copy that implies the chain of custody is
guaranteed. It is socially reported, not cryptographically proven.

---

## 2. The physical layer

Context you need in order to understand the constraints below.

Stickers are roughly 8.3 × 13.9 mm and go on the back of a pin. The QR is 6 mm square. Because the
QR is that small, the encoded string has a hard character budget, which is where most of the rules
in section 4 come from.

Stickers are **printed in batches before any pin exists.** A collector buys a sheet, sticks them on
pins they already own, then registers each one. This has a direct architectural consequence: a slug
must already exist in the database, in an unclaimed state, before anyone ever scans it. See
section 5.

The printed sticker is permanent and unchangeable. Whatever domain is printed on it must resolve
forever. Treat that as a hard constraint, not a preference.

---

## 3. Domains and routing

Two domains, with sharply different jobs.

**`wanderingpins.com`** — the real product. Marketing site, app, all pin pages, all authenticated
flows. This is the brand.

**`wpins.co`** — a dumb redirector. It appears only on stickers, because it is short enough to fit
in a Version 1 QR code. It must never host application logic.

### Redirect behaviour

```
GET https://wpins.co/{slug}
  → 302 → https://wanderingpins.com/p/{normalised-slug}
```

Use **302, not 301.** A 301 is cached indefinitely by browsers and intermediaries, and if you ever
need to repoint a code you will not be able to. These pages are not SEO targets, so there is no
upside to 301 that offsets that risk.

### Implementation note

For v1, serve both hosts from the same Next.js app and branch on the `Host` header in middleware.
But keep all redirect logic in a single module with **zero imports from the rest of the app**, so it
can be extracted to a standalone service later. The long-term goal is that wpins.co can survive a
complete rebuild or rebrand of the main product, because stickers in the wild depend on it.

---

## 4. The slug — read this section carefully

The slug is the pin's identity. Almost every bug in this system will come from getting this wrong.

### Format

Seven characters: **6 random data characters + 1 check character.**

Alphabet is Crockford base32, 32 symbols:

```
0123456789ABCDEFGHJKMNPQRSTVWXYZ
```

Note what is missing: **I, L, O and U.** I and L are omitted because they look like 1; O because it
looks like 0; U to reduce accidental profanity. This is deliberate and load-bearing — do not
"fix" the alphabet to be a standard base32.

Keyspace is 32^6 ≈ 1.07 billion pins. That is far beyond the total number of collectible lapel pins
ever manufactured, so do not trade readability for address space.

### Check character

Compute over the 6 data characters using position weights and mod 32, encoded back into the same
alphabet. This catches every single-character substitution and most transpositions, which is the
point: a mistyped code should say *"no such pin"* rather than silently resolving to a stranger's
pin. That silent-wrong-pin case is the failure mode we are buying protection against.

### Normalisation — required on every input path

Before any lookup, normalise:

1. Strip whitespace and hyphens
2. Uppercase
3. Map `I` → `1`, `L` → `1`, `O` → `0`

Step 3 is the entire reason for the alphabet choice. Someone reading 4.4 pt type off a sticker will
type the letter O, and that must just work.

Then validate the check character before hitting the database. Reject malformed codes with a helpful
message, not a 404.

### Canonicalisation

If the normalised slug differs from what was requested, 302 to the canonical uppercase form so the
URL in the address bar is the shareable one.

### Storage

**Store the bare slug. Never store a full URL anywhere in the database.**

If a pin row holds `K7M2QX9`, the domain is a presentation detail you can change freely. If it holds
`https://wpins.co/K7M2QX9`, you have baked a hostname into every record and changing anything means
a data migration. This rule has no exceptions.

---

## 5. Data model

Postgres via Prisma. Names below are indicative; keep the semantics.

The central idea: **a pin's journey is its sequence of holdings.** Each holding is one person's leg
of the trip. Public data lives on the holding; private data hangs off it.

### `pins`

The physical object.

| field | notes |
|---|---|
| `id` | internal PK |
| `slug` | 7 chars, unique, indexed, uppercase canonical form |
| `status` | `MINTED` \| `REGISTERED` — see lifecycle below |
| `batch_id` | which sticker batch this slug was minted in |
| `created_at` | when the slug was minted |
| `registered_at` | nullable |

Note there is **no title field on the pin.** See section 7 — the pin's name is private in v1.

**Lifecycle.** A slug is created as `MINTED` when a sticker batch is generated — before the sticker
is even printed. Scanning a `MINTED` pin must render a "this pin hasn't been registered yet, claim
it" page, **not a 404.** The first registration moves it to `REGISTERED`.

Getting this wrong is the single most likely way to ship something broken, because in development
you will naturally create pins first and scan second, which is backwards from reality.

### `sticker_batches`

| field | notes |
|---|---|
| `id`, `created_at`, `label`, `quantity` | |

Lets you mint N slugs at once, hand the list to the sticker generator, and know which physical sheet
a code came from.

### `users`

| field | notes |
|---|---|
| `id`, `email`, `created_at` | |
| `username` | unique, nullable — null until onboarding is completed (section 6.2); this is the public identity, replacing the old auto-generated display name |
| `first_name`, `last_name` | optional, private — never rendered on any public page |
| `city` | optional, private — where they live, never rendered on any public page |
| `show_name_publicly` | boolean, default true — gates whether `username` or "a collector" shows on the public journey |

### `pin_holdings` — the journey spine

One row per person-per-stint-with-a-pin. This table renders the public page.

| field | notes |
|---|---|
| `id`, `pin_id`, `user_id` | |
| `acquired_at` | date the person got it |
| `acquired_via` | enum: `BOUGHT` \| `TRADED` \| `GIFT` \| `FOUND` \| `OTHER` |
| `place_label` | derived city string, e.g. "Orlando, FL" |
| `lat`, `lng` | **coarse — city centroid, never precise** |
| `released_at` | nullable; null means they still have it |

Constraints: at most one holding per pin with `released_at IS NULL`. That open holding is the
current owner. A user's full history is simply all their holdings, open and closed — this is what
"every pin I have ever had" means.

**Every field on this table is public.** Nothing free-typed appears here, which is deliberate; see
section 7.

### `holding_notes` — private

| field | notes |
|---|---|
| `id`, `holding_id`, `body`, `updated_at` | |
| `release_date`, `release_place_label` | optional — when/where the holder let this pin go with no specific recipient (section 6.4), reachable right after releasing |

One private blurb per holding. Readable only by the user who owns that holding. This is where "I
bought it at Disney with my daughter and she picked it out" lives — or, at the other end of a
holding's life, "left it on the pin board by the Epcot entrance."

Scoped to the holding rather than to the pin, so if someone acquires the same pin twice they get a
separate note for each stint. That is more truthful to the journey and simpler to reason about.

### `holding_photos` — private

| field | notes |
|---|---|
| `id`, `holding_id`, `url`, `kind` (`FRONT` \| `BACK` \| `OTHER`), `created_at` | |

Readable only by the user who owns that holding. **Never rendered on any public page in v1.**

Photos still do real work even while private: they are what actually ties a code to a specific
physical object for its owner, and they are the record if a dispute ever arises. They are just not
public.

### `pin_titles` — private

| field | notes |
|---|---|
| `id`, `holding_id`, `title` | |

What the holder calls this pin. Private, because it is free-typed. See section 7.

There is no `trades` table. Releasing a pin has no recipient to record (section 6.4) — the current
holder just closes their own holding, and whoever finds the pin later opens a fresh one for
themselves the same way anyone claims a never-before-registered pin. There's nothing to address, so
there's nothing to store beyond the holding itself.

---

## 6. Core flows — v1 scope

Build exactly these. Everything else is out of scope.

### 6.1 Scan or type a code → public pin page

Route: `/p/{slug}`. **No authentication required.** This is the most important page in the product.

Assume the visitor has never heard of Wandering Pins. They were handed a pin by a friend, noticed a
tiny sticker, and pointed their camera at it. This page is your entire acquisition funnel.

Two states:

- **`REGISTERED`** — the journey. A map with a line connecting the places the pin has been, and a
  timeline beneath it. Each leg reads as generated prose from structured fields, e.g.
  *"Bought in Orlando, FL · March 2024"* → *"Traded in Denver, CO · June 2024"*. Show the holder's
  display name, or "a collector" if they've opted out. End with a warm prompt to claim it if they
  now own it.
- **`MINTED`** — "This pin hasn't been registered yet." Offer to register it. Do not show an error.

**Design note.** With no photo and no free text, the map and timeline carry this page alone. Invest
the visual effort there — this is the one screen that has to charm a stranger in about four seconds.

### 6.2 Sign in and onboarding

Email magic link, or email+password once a password has been set. No social login. Signing in is
required for everything except the public pin page.

A brand-new sign-in has no `username` yet, and picking a unique one can't be guessed — so the first
time anyone reaches a protected page with `username = null`, they're redirected to onboard first
(then sent on to wherever they were headed). Onboarding collects: a unique username, a **required**
password, and optionally first name, last name, and city.

The required password exists so an account never depends solely on continued access to one inbox —
if someone changes jobs or loses an old email address, they can still sign in with their password
and update their email from settings. If they instead forget their *password* but still have their
email, magic-link sign-in is the recovery path — no separate "forgot password" flow is needed.

### 6.3 Register a pin

Authenticated. Claim a `MINTED` slug, or claim a `REGISTERED` pin that currently has no holder
(section 6.4) — same form either way, since the only real precondition is "no open holding exists."

Capture: how you got it (`acquired_via`), roughly when, and a coarse location. Optionally a private
title, private notes, and private photos. Opens a holding.

### 6.4 Log a trade

Authenticated. The current holder releases the pin with **no recipient specified at all** — this is
the whole point. One click closes their holding and moves it to "ever had" immediately; there is no
pending state, no email or username to provide, and nothing to wait on. Think of a pin left on a
pinboard for a stranger to find: the two people never interact, and the giver usually has no idea
who ends up with it next.

Afterward, optionally and privately (only the person who released it ever sees this): when they let
it go, where, and anything else about the trade ("gave it to a friend," "left it for someone to
find"). This lives on the same holding — see `holding_notes` in section 5.

Whoever finds the pin later scans its own sticker code and goes through 6.3 above, exactly as if it
had never been registered. There's no invite, no addressing, nothing for the previous holder to do
or be notified about.

### 6.5 My pins

Authenticated. Two views off one page:

- **Currently have** — open holdings.
- **Ever had** — every holding, open and closed, newest first. Each entry links to that pin's public
  journey page, so a collector can see where a pin went *after* they let it go. That "what happened
  to it next" moment is a core part of the appeal — make it prominent rather than burying it.

### 6.6 Private notes and photos

Authenticated, scoped to one of your own holdings. Add and edit a blurb, a title, and photos.
Visible only to you. Make the privacy obvious in the UI — a small persistent "only you can see this"
affordance, not a one-time tooltip.

### 6.7 Account settings

Authenticated, self-only — there is no public profile page for viewing *other* users' settings, just
this one page for editing your own. Two independent forms:

- **Profile**: username, first/last name, city. Username changes hit the same uniqueness constraint
  as onboarding.
- **Email**: request a change to a new address. Nothing changes until the confirmation link sent to
  the *new* address is clicked — the UI must say so, not imply it's instant. Because this uses
  Supabase's real account-level email change rather than just signing in with a different address,
  the same underlying identity (and so the same collection) carries over; signing in with a
  different email instead of using this flow creates an unrelated new, empty account.

---

## 7. What is public, and what is not

This section is a hard boundary. Do not soften it without an explicit product decision.

### Public — visible to anyone who scans

- The pin's slug
- Its holdings: acquisition method, coarse city, date
- Holder usernames, subject to `show_name_publicly`

That is the complete list, and every item is **structured** — chosen from an enum, derived from a
geocoder, or a date. **No user-typed text and no user-uploaded images appear on any public page.**

### Private — visible only to the person who wrote it

- Notes, titles, photos

### Why it is drawn here

Pin trading skews heavily toward families and children, particularly around theme parks. Public
user-generated images combined with a young audience is the single fastest way to turn this into a
content-moderation operation, and doing that properly means automated screening, a report path, and
a human actioning reports — from day one, not later.

By keeping every public field structured, v1 has **no moderation surface at all.** That is worth
more than a prettier page.

### The known cost

The public page has no picture of the pin and no name for it. A stranger sees a journey, not an
object. This is a real loss and it is accepted deliberately.

### What v2 would need before this can change

Do not enable public photos or public free text until all of the following exist:

1. Automated screening on upload (NSFW and CSAM detection) with hard-fail on positives
2. A report button on every public page, and an unpublish action that takes effect immediately
3. A named person responsible for actioning reports, with a response-time target
4. A retention and takedown policy that survives the uploader deleting their account

Promoting the title to public is much lower risk than photos and is a reasonable first step once
items 2 and 3 exist.

---

## 8. Privacy and abuse

- Store and display **city-level** locations only. Never publish precise coordinates, even if the
  browser offers them. Snap to a city centroid before storing, not at render time.
- **Strip EXIF on upload.** Phone photos embed GPS. Even though photos are private in v1, do not
  keep coordinates you have promised not to expose.
- Show usernames, never email addresses. Honour `show_name_publicly`, falling back to "a
  collector".
- Rate-limit `/p/{slug}` by IP. With a ~1 billion keyspace, random guessing is otherwise a viable
  way to scrape the map. This is the compensating control for spending a character on the check
  digit rather than on entropy.

---

## 9. QR generation rules

If you build a code-generation endpoint or script, these are hard requirements.

Encode **exactly** this string, with no scheme and no `www`:

```
WPINS.CO/{SLUG}
```

Uppercase, always. Constraints, and why:

- **Uppercase only.** Lowercase drops QR out of alphanumeric mode into byte mode and forces
  Version 2, which means smaller modules at the same physical size and a code that stops scanning
  reliably at 6 mm.
- **No `https://` prefix.** It also forces Version 2. Phone cameras recognise a bare domain fine.
- **The result must be QR Version 1 at ECC level Q.** `WPINS.CO/` is 9 characters and Version 1 at
  ECC Q holds 16, leaving exactly 7 for the slug. There is no slack.

**Add a test that asserts every generated code is Version 1.** If a change ever pushes a code to
Version 2, the physical stickers silently stop scanning on older phones and you will not find out
until they are printed. Fail the build instead.

---

## 10. Stack and conventions

- **Next.js** (App Router) + **TypeScript**
- **Postgres** via **Prisma**
- **Auth**: email magic link
- **Images**: object storage with signed uploads, private ACL by default. Resize and strip EXIF.
- **Maps**: MapLibre GL with a configurable tile source. Keep the provider behind one config value.
- **Geocoding**: forward-geocode a typed place name to a city centroid. Never store what the browser
  geolocation API returns without rounding it first.
- **Hosting**: Vercel. Both domains point at the same deployment; middleware branches on `Host`.

Conventions: server components by default; server actions for mutations; Zod at every input
boundary, including the slug parser. Authorisation checks on every private read — a holding's notes
and photos must be unreachable by anyone but their owner, including by direct URL to the asset.

---

## 11. Gotchas that will bite

Collected in one place because each of these has already been reasoned through and each is easy to
get wrong.

1. **URL paths are case-sensitive by spec.** The QR encodes uppercase. Someone typing the printed
   code will use lowercase. Normalise before lookup or hand-typed codes will 404 while scanned ones
   work — an especially confusing bug because it only shows up for the fallback path.
2. **Slugs must pre-exist as `MINTED` rows.** Stickers are printed before pins are claimed.
3. **302, not 301,** on the wpins.co redirect.
4. **Never store a full URL** as a pin's identity.
5. **Private photos need private storage.** A signed-upload URL that stays publicly readable is not
   private. Check the bucket ACL, not just the app's routing.
6. **Strip EXIF from uploads.**
7. **Assert QR Version 1 in tests.**
8. **Do not let the redirector grow features.** The moment wpins.co has a database dependency, every
   sticker ever printed inherits that fragility.
9. **Closed holdings are not deletions.** A user who trades a pin away keeps their holding, their
   notes and their photos. Never cascade-delete a holding when ownership moves.

---

## 12. Definition of done

v1 is finished when all of the following pass:

- [ ] Minting a batch of 1,000 slugs produces 1,000 unique codes, all valid Crockford base32 with
      correct check characters, and every corresponding QR renders as Version 1.
- [ ] `wpins.co/k7m2qx9`, `WPINS.CO/K7M2QX9` and `wpins.co/K7M2QX9` all land on the same canonical
      page.
- [ ] A code typed with `O` for `0` and `I` for `1` resolves correctly.
- [ ] A code with a bad check character returns a helpful "that code doesn't look right" page, not
      a 404 and not a wrong pin.
- [ ] Scanning a `MINTED` slug shows a claim page, not an error.
- [ ] A logged-out visitor can view a registered pin's journey and map.
- [ ] **No public page renders any user-typed text or any user-uploaded image.** Assert this in a
      test that walks the public page's rendered output.
- [ ] A second user cannot read another user's notes, titles or photos, including by direct asset
      URL.
- [ ] After trading a pin away, the original owner still sees it under "ever had", still sees their
      own notes and photos, and can see the journey continue.
- [ ] No page anywhere renders precise coordinates or an email address.
- [ ] Rate limiting on `/p/{slug}` is active and tested.

---

## Appendix — worked example

```
slug            K7M2QX9        (6 data chars + check char)
encoded in QR   WPINS.CO/K7M2QX9
QR              Version 1, ECC Q, 21×21 modules
printed at      6 mm → 0.286 mm per module
sticker         8.3 × 13.9 mm, reads:  wpins.co
                                       K7M2QX9
scan resolves   wpins.co/K7M2QX9 → 302 → wanderingpins.com/p/K7M2QX9
stored as       pins.slug = 'K7M2QX9'

public page     Bought in Orlando, FL · March 2024 · Tim
                Traded in Denver, CO · June 2024 · Sarah
                Traded in Osaka, Japan · November 2024 · a collector

Tim also sees   his own title, blurb and photos from his stint,
                and that the pin is now in Osaka
```
