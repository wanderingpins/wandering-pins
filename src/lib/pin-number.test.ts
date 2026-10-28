import { describe, expect, it } from "vitest";
import { parsePinNumber } from "./pin-number";

describe("parsePinNumber", () => {
  it("accepts plain positive integers", () => {
    expect(parsePinNumber("1")).toBe(1);
    expect(parsePinNumber("1042")).toBe(1042);
    expect(parsePinNumber("2147483647")).toBe(2147483647);
  });

  it("rejects anything else, including sticker-code-shaped input", () => {
    for (const raw of ["", "0", "01", "-5", "1.5", "1e3", " 7", "K7M2QX9", "2147483648", "99999999999"]) {
      expect(parsePinNumber(raw)).toBeNull();
    }
  });
});
