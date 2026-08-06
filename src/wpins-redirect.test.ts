import { describe, expect, it } from "vitest";
import { buildRedirectUrl, isRedirectorHost } from "./wpins-redirect";

describe("isRedirectorHost", () => {
  it("matches wpins.co with or without a port, case-insensitively", () => {
    expect(isRedirectorHost("wpins.co")).toBe(true);
    expect(isRedirectorHost("WPINS.CO")).toBe(true);
    expect(isRedirectorHost("wpins.co:443")).toBe(true);
    expect(isRedirectorHost("www.wpins.co")).toBe(true);
  });

  it("does not match the app domain", () => {
    expect(isRedirectorHost("wanderingpins.com")).toBe(false);
    expect(isRedirectorHost("localhost:3000")).toBe(false);
  });
});

describe("buildRedirectUrl", () => {
  it("builds a canonical /p/{slug} URL on the app domain", () => {
    expect(buildRedirectUrl("/K7M2QX9")).toBe("https://wanderingpins.com/p/K7M2QX9");
  });

  it("normalises case, hyphens, and look-alike characters", () => {
    expect(buildRedirectUrl("/k7m2-qx9")).toBe("https://wanderingpins.com/p/K7M2QX9");
    expect(buildRedirectUrl("/k7m2qO9")).toBe("https://wanderingpins.com/p/K7M2Q09");
    expect(buildRedirectUrl("/k7m2qI9")).toBe("https://wanderingpins.com/p/K7M2Q19");
  });

  it("falls back to the app root when there is no slug", () => {
    expect(buildRedirectUrl("/")).toBe("https://wanderingpins.com/");
    expect(buildRedirectUrl("")).toBe("https://wanderingpins.com/");
  });
});
