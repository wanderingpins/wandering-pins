import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it } from "vitest";
import { proxy } from "./proxy";
import { prisma } from "./lib/prisma";

// A fresh IP per test — isRateLimited is keyed by IP, and reusing a fixed
// one would make repeated local test runs flaky as hits accumulate within
// the same 60s window.
function requestFor(host: string, path: string, ip = randomUUID()) {
  return new NextRequest(`https://${host}${path}`, { headers: { host, "x-forwarded-for": ip } });
}

const testIps: string[] = [];
afterEach(async () => {
  if (testIps.length) {
    await prisma.rateLimitHit.deleteMany({ where: { ip: { in: testIps } } });
    testIps.length = 0;
  }
});

describe("proxy", () => {
  it("302s wpins.co to the canonical app URL", async () => {
    const res = await proxy(requestFor("wpins.co", "/k7m2-qx9"));
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("https://wanderingpins.com/p/K7M2QX9");
  });

  it("302s a non-canonical /p/{slug} on the app host to the canonical form", async () => {
    const res = await proxy(requestFor("wanderingpins.com", "/p/k7m2qx9"));
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("https://wanderingpins.com/p/K7M2QX9");
  });

  it("passes an already-canonical /p/{slug} through unmodified", async () => {
    const res = await proxy(requestFor("wanderingpins.com", "/p/K7M2QX9"));
    expect(res.status).toBe(200);
  });

  it("passes other app-host paths through unmodified", async () => {
    const res = await proxy(requestFor("wanderingpins.com", "/"));
    expect(res.status).toBe(200);
  });

  it("rate-limits repeated /p/{slug} requests from the same IP", async () => {
    const ip = randomUUID();
    testIps.push(ip);

    for (let i = 0; i < 30; i++) {
      const res = await proxy(requestFor("wanderingpins.com", "/p/K7M2QX9", ip));
      expect(res.status).toBe(200);
    }
    const blocked = await proxy(requestFor("wanderingpins.com", "/p/K7M2QX9", ip));
    expect(blocked.status).toBe(429);
  });

  it("rate-limits repeated /pins requests from the same IP", async () => {
    const ip = randomUUID();
    testIps.push(ip);

    for (let i = 0; i < 30; i++) {
      const res = await proxy(requestFor("wanderingpins.com", "/pins", ip));
      expect(res.status).toBe(200);
    }
    const blocked = await proxy(requestFor("wanderingpins.com", "/pins", ip));
    expect(blocked.status).toBe(429);
  });

  it("rate-limits repeated /series requests from the same IP", async () => {
    const ip = randomUUID();
    testIps.push(ip);

    for (let i = 0; i < 30; i++) {
      const res = await proxy(requestFor("wanderingpins.com", "/series", ip));
      expect(res.status).toBe(200);
    }
    const blocked = await proxy(requestFor("wanderingpins.com", "/series", ip));
    expect(blocked.status).toBe(429);
  });

  it("does not rate-limit other app-host paths", async () => {
    const ip = randomUUID();
    testIps.push(ip);

    for (let i = 0; i < 40; i++) {
      const res = await proxy(requestFor("wanderingpins.com", "/", ip));
      expect(res.status).toBe(200);
    }
  });
});
