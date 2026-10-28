// Pin.number is a Postgres SERIAL (int4). Digits only, no leading zeros or
// signs, and capped so a huge value can't overflow the column in a query.
const MAX_PIN_NUMBER = 2_147_483_647;

export function parsePinNumber(raw: string): number | null {
  if (!/^[1-9]\d{0,9}$/.test(raw)) return null;
  const n = Number(raw);
  return n <= MAX_PIN_NUMBER ? n : null;
}
