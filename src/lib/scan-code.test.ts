import { describe, expect, it } from "vitest";
import { extractCodeFromScan } from "./scan-code";

describe("extractCodeFromScan", () => {
  it("extracts the code from the real sticker QR payload", () => {
    expect(extractCodeFromScan("WWW.WPINS.CO/K7M2QX9")).toBe("K7M2QX9");
  });

  it("extracts the code from a full URL with scheme", () => {
    expect(extractCodeFromScan("https://www.wpins.co/k7m2qx9")).toBe("k7m2qx9");
    expect(extractCodeFromScan("http://wpins.co/K7M2QX9")).toBe("K7M2QX9");
  });

  it("trims surrounding whitespace", () => {
    expect(extractCodeFromScan("  WWW.WPINS.CO/K7M2QX9  ")).toBe("K7M2QX9");
  });

  it("drops a query string or trailing slash", () => {
    expect(extractCodeFromScan("https://www.wpins.co/K7M2QX9?utm_source=sticker")).toBe("K7M2QX9");
    expect(extractCodeFromScan("https://www.wpins.co/K7M2QX9/")).toBe("K7M2QX9");
  });

  it("passes through a bare code with no URL at all", () => {
    expect(extractCodeFromScan("K7M2QX9")).toBe("K7M2QX9");
  });
});
