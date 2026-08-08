import { describe, expect, it } from "vitest";
import { usernameSchema } from "./username";

describe("usernameSchema", () => {
  it("accepts lowercase letters, digits, and underscores within length", () => {
    expect(usernameSchema.safeParse("john_doe123").success).toBe(true);
    expect(usernameSchema.safeParse("abc").success).toBe(true);
    expect(usernameSchema.safeParse("a".repeat(20)).success).toBe(true);
  });

  it("lowercases and trims before validating", () => {
    expect(usernameSchema.parse(" JohnDoe ")).toBe("johndoe");
  });

  it("rejects too short, too long, and disallowed characters", () => {
    expect(usernameSchema.safeParse("ab").success).toBe(false);
    expect(usernameSchema.safeParse("a".repeat(21)).success).toBe(false);
    expect(usernameSchema.safeParse("john doe").success).toBe(false);
    expect(usernameSchema.safeParse("john.doe").success).toBe(false);
    expect(usernameSchema.safeParse("john@doe").success).toBe(false);
  });
});
