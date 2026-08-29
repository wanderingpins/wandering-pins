// Shared by the Series/SeriesItem catalog (src/app/series) — display text
// plus a normalised key so near-duplicate typing ("Star Wars" vs
// "star  wars ") merges into the same row instead of fragmenting the
// catalog. Same defensive-normalisation instinct as the slug alphabet in
// brief section 4. Creating a series or item is really "find-or-create by
// normalised key" (see src/app/series/actions.ts), enforced by a DB unique
// constraint on the key, not just a UI convention.
export const MAX_SERIES_NAME_LENGTH = 100;
export const MAX_SERIES_ITEM_LABEL_LENGTH = 80;

export function normalizeSeriesKey(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").toLowerCase();
}
