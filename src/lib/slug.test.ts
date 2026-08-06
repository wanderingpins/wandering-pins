import { describe, expect, it } from "vitest";
import { ALPHABET, computeCheckChar, generateSlug, normalizeSlugInput, parseSlug } from "./slug";

describe("normalizeSlugInput", () => {
  it("strips whitespace and hyphens, uppercases, and maps look-alikes", () => {
    expect(normalizeSlugInput(" k7m-2qx9 ")).toBe("K7M2QX9");
    expect(normalizeSlugInput("k7m2qO9")).toBe("K7M2Q09");
    expect(normalizeSlugInput("k7m2qI9")).toBe("K7M2Q19");
    expect(normalizeSlugInput("k7m2qL9")).toBe("K7M2Q19");
  });
});

describe("computeCheckChar", () => {
  it("is deterministic for the same input", () => {
    expect(computeCheckChar("K7M2QX")).toBe(computeCheckChar("K7M2QX"));
  });

  it("changes when any single data character changes", () => {
    const base = "K7M2QX";
    const baseCheck = computeCheckChar(base);
    for (let i = 0; i < base.length; i++) {
      for (const ch of ALPHABET) {
        if (ch === base[i]) continue;
        const mutated = base.slice(0, i) + ch + base.slice(i + 1);
        expect(computeCheckChar(mutated)).not.toBe(baseCheck);
      }
    }
  });
});

describe("generateSlug", () => {
  it("produces a slug that parses as valid", () => {
    const slug = generateSlug();
    expect(slug).toHaveLength(7);
    expect(parseSlug(slug)).toEqual({ valid: true, slug });
  });

  it("mints 1000 unique, valid slugs", () => {
    const slugs = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      const slug = generateSlug();
      expect(parseSlug(slug).valid).toBe(true);
      slugs.add(slug);
    }
    expect(slugs.size).toBe(1000);
  });
});

describe("parseSlug", () => {
  it("accepts a canonical slug", () => {
    const slug = generateSlug();
    expect(parseSlug(slug)).toEqual({ valid: true, slug });
  });

  it("resolves a code typed with O for 0 and I for 1", () => {
    const slug = generateSlug();
    // Only remap if the slug actually contains characters this would affect.
    const withTypos = slug.replace(/0/g, "O").replace(/1/g, "I").toLowerCase();
    expect(parseSlug(withTypos)).toEqual({ valid: true, slug });
  });

  it("is case-insensitive and ignores hyphens/whitespace", () => {
    const slug = generateSlug();
    const spaced = ` ${slug.slice(0, 3)}-${slug.slice(3)} `.toLowerCase();
    expect(parseSlug(spaced)).toEqual({ valid: true, slug });
  });

  it("rejects the wrong length as malformed", () => {
    expect(parseSlug("K7M2QX")).toEqual({ valid: false, reason: "malformed" });
    expect(parseSlug("K7M2QX99")).toEqual({ valid: false, reason: "malformed" });
  });

  it("rejects characters outside the alphabet as malformed", () => {
    // U is deliberately excluded from the alphabet and has no remapping.
    expect(parseSlug("K7M2QU9")).toEqual({ valid: false, reason: "malformed" });
  });

  it("rejects a wrong check character distinctly from malformed input", () => {
    const slug = generateSlug();
    const dataChars = slug.slice(0, 6);
    const realCheck = slug.slice(6);
    const wrongCheck = ALPHABET[(ALPHABET.indexOf(realCheck) + 1) % 32];
    expect(parseSlug(dataChars + wrongCheck)).toEqual({ valid: false, reason: "bad_check_char" });
  });
});
