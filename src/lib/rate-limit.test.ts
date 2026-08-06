import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "./prisma";
import { getClientIp, isRateLimited } from "./rate-limit";

describe("getClientIp", () => {
  it("prefers the first x-forwarded-for entry", () => {
    expect(getClientIp(new Headers({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" }))).toBe("1.2.3.4");
  });

  it("falls back to x-real-ip, then unknown", () => {
    expect(getClientIp(new Headers({ "x-real-ip": "9.9.9.9" }))).toBe("9.9.9.9");
    expect(getClientIp(new Headers())).toBe("unknown");
  });
});

describe("isRateLimited", () => {
  const testIps: string[] = [];

  afterEach(async () => {
    if (testIps.length) {
      await prisma.rateLimitHit.deleteMany({ where: { ip: { in: testIps } } });
      testIps.length = 0;
    }
  });

  it("allows requests under the threshold and blocks once it's exceeded", async () => {
    const ip = `test-${randomUUID()}`;
    testIps.push(ip);

    for (let i = 0; i < 30; i++) {
      expect(await isRateLimited(ip)).toBe(false);
    }
    expect(await isRateLimited(ip)).toBe(true);
  });

  it("tracks separate IPs independently", async () => {
    const ipA = `test-${randomUUID()}`;
    const ipB = `test-${randomUUID()}`;
    testIps.push(ipA, ipB);

    for (let i = 0; i < 30; i++) await isRateLimited(ipA);
    expect(await isRateLimited(ipA)).toBe(true);
    expect(await isRateLimited(ipB)).toBe(false);
  });
});
