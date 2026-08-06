import { randomBytes } from "node:crypto";

// Crockford base32 minus I, L, O, U — see brief section 4. Do not "fix" this
// to standard base32; the omissions are load-bearing (I/L/1 confusion, O/0
// confusion, U for profanity reduction).
export const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

const CHAR_VALUES = new Map<string, number>(
  [...ALPHABET].map((ch, i) => [ch, i])
);

// One odd (unit mod 32) weight per data-character position. Odd weights
// guarantee every single-character substitution changes the checksum
// (multiplying by a unit mod 32 is a bijection on nonzero deltas). Adjacent
// weights differ by 2, so a transposition is undetected only when the two
// swapped values differ by exactly 16 — "most transpositions", as documented
// in brief section 4, not all.
const WEIGHTS = [1, 3, 5, 7, 9, 11];

const DATA_LENGTH = 6;
const SLUG_LENGTH = DATA_LENGTH + 1;

export function computeCheckChar(dataChars: string): string {
  if (dataChars.length !== DATA_LENGTH) {
    throw new Error(`expected ${DATA_LENGTH} data characters, got ${dataChars.length}`);
  }
  let sum = 0;
  for (let i = 0; i < DATA_LENGTH; i++) {
    const value = CHAR_VALUES.get(dataChars[i]);
    if (value === undefined) {
      throw new Error(`character '${dataChars[i]}' is not in the slug alphabet`);
    }
    sum += value * WEIGHTS[i];
  }
  return ALPHABET[sum % 32];
}

// Required on every input path before a lookup (brief section 4):
// 1. strip whitespace and hyphens, 2. uppercase, 3. map I/L -> 1, O -> 0.
// This is the entire reason for the alphabet choice — someone reading 4.4pt
// type off a sticker will type the letter O, and that must just work.
export function normalizeSlugInput(raw: string): string {
  return raw
    .replace(/[\s-]/g, "")
    .toUpperCase()
    .replace(/[IL]/g, "1")
    .replace(/O/g, "0");
}

export type SlugParseResult =
  | { valid: true; slug: string }
  | { valid: false; reason: "malformed" | "bad_check_char" };

// Normalises, validates shape/alphabet, then verifies the check character.
// Malformed input (wrong length, char outside the alphabet) and a
// well-formed code with a wrong check character are distinguished so callers
// can show "that code doesn't look right" instead of a bare 404 either way.
export function parseSlug(raw: string): SlugParseResult {
  const normalized = normalizeSlugInput(raw);
  if (normalized.length !== SLUG_LENGTH || ![...normalized].every((ch) => CHAR_VALUES.has(ch))) {
    return { valid: false, reason: "malformed" };
  }
  const dataChars = normalized.slice(0, DATA_LENGTH);
  const checkChar = normalized.slice(DATA_LENGTH);
  if (computeCheckChar(dataChars) !== checkChar) {
    return { valid: false, reason: "bad_check_char" };
  }
  return { valid: true, slug: normalized };
}

// Mints a new random slug for a sticker batch. 32 is a power of two, so
// masking a random byte with 0x1F is an unbiased pick from the alphabet —
// no modulo bias to worry about.
export function generateSlug(): string {
  const bytes = randomBytes(DATA_LENGTH);
  let dataChars = "";
  for (let i = 0; i < DATA_LENGTH; i++) {
    dataChars += ALPHABET[bytes[i] & 0x1f];
  }
  return dataChars + computeCheckChar(dataChars);
}
