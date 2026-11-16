import { describe, expect, it } from "vitest";
import { shortPlace } from "./place";

describe("shortPlace", () => {
  it("abbreviates US states and drops the country", () => {
    expect(shortPlace("Denver, Colorado, United States")).toBe("Denver, CO");
    expect(shortPlace("San Francisco, California, United States")).toBe("San Francisco, CA");
    expect(shortPlace("Washington, District of Columbia, United States")).toBe("Washington, DC");
  });

  it("finds the state past a county", () => {
    expect(shortPlace("Golden, Jefferson County, Colorado, United States")).toBe("Golden, CO");
  });

  it("keeps city and country elsewhere", () => {
    expect(shortPlace("Paris, Île-de-France, France")).toBe("Paris, France");
    expect(shortPlace("Kyoto, Japan")).toBe("Kyoto, Japan");
  });

  it("handles a state without the country, and a bare name", () => {
    expect(shortPlace("Austin, Texas")).toBe("Austin, TX");
    expect(shortPlace("Tokyo")).toBe("Tokyo");
  });
});
