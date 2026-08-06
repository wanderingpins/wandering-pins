import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { proxy } from "./proxy";

function requestFor(host: string, path: string) {
  return new NextRequest(`https://${host}${path}`, { headers: { host } });
}

describe("proxy", () => {
  it("302s wpins.co to the canonical app URL", async () => {
    const res = proxy(requestFor("wpins.co", "/k7m2-qx9"));
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("https://wanderingpins.com/p/K7M2QX9");
  });

  it("302s a non-canonical /p/{slug} on the app host to the canonical form", async () => {
    const res = proxy(requestFor("wanderingpins.com", "/p/k7m2qx9"));
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("https://wanderingpins.com/p/K7M2QX9");
  });

  it("passes an already-canonical /p/{slug} through unmodified", async () => {
    const res = proxy(requestFor("wanderingpins.com", "/p/K7M2QX9"));
    expect(res.status).toBe(200);
  });

  it("passes other app-host paths through unmodified", async () => {
    const res = proxy(requestFor("wanderingpins.com", "/"));
    expect(res.status).toBe(200);
  });
});
