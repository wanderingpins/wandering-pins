import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "./prisma";

// username is nullable (everyone mid-onboarding sits at NULL without
// colliding — see schema comment on User.username) but must be unique once
// set. This is the actual guarantee completeOnboarding/updateProfile rely on
// when they catch a P2002 instead of pre-checking with findUnique first.
describe("username uniqueness", () => {
  const userIds: string[] = [];

  afterEach(async () => {
    for (const id of userIds) {
      await prisma.user.delete({ where: { id } }).catch(() => {});
    }
    userIds.length = 0;
  });

  it("allows multiple users with no username, but rejects a duplicate once set", async () => {
    const a = await prisma.user.create({
      data: { id: randomUUID(), email: `a-${randomUUID()}@example.com` },
    });
    const b = await prisma.user.create({
      data: { id: randomUUID(), email: `b-${randomUUID()}@example.com` },
    });
    userIds.push(a.id, b.id);
    expect(a.username).toBeNull();
    expect(b.username).toBeNull();

    const claimed = `collector_${randomUUID().slice(0, 8)}`;
    await prisma.user.update({ where: { id: a.id }, data: { username: claimed } });

    await expect(prisma.user.update({ where: { id: b.id }, data: { username: claimed } })).rejects.toThrow();
  });
});

// getOrCreateAppUser's upsert (src/lib/auth.ts) runs `update: { email: claims.email }`
// on every authenticated request — this is the entire mechanism behind
// "change your email without losing your collection": the id (Supabase Auth
// UUID) never changes, so PinHolding rows stay attached regardless of what
// email is on file.
describe("email sync via upsert", () => {
  const userIds: string[] = [];

  afterEach(async () => {
    for (const id of userIds) {
      await prisma.user.delete({ where: { id } }).catch(() => {});
    }
    userIds.length = 0;
  });

  it("updates email in place while id and username stay the same", async () => {
    const id = randomUUID();
    const originalEmail = `old-${randomUUID()}@example.com`;
    const newEmail = `new-${randomUUID()}@example.com`;
    const username = `stays_put_${randomUUID().slice(0, 8)}`;

    const created = await prisma.user.upsert({
      where: { id },
      update: { email: originalEmail },
      create: { id, email: originalEmail, username },
    });
    userIds.push(created.id);
    expect(created.email).toBe(originalEmail);

    // Simulates the next authenticated request after a confirmed Supabase
    // email change — same shape getOrCreateAppUser runs.
    const synced = await prisma.user.upsert({
      where: { id },
      update: { email: newEmail },
      create: { id, email: newEmail, username },
    });

    expect(synced.id).toBe(id);
    expect(synced.username).toBe(username);
    expect(synced.email).toBe(newEmail);

    const holdingsOwner = await prisma.user.findUniqueOrThrow({ where: { id } });
    expect(holdingsOwner.email).toBe(newEmail);
  });
});
