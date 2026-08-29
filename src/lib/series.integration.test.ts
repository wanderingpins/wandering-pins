import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "./prisma";
import { normalizeSeriesKey } from "./series";

// These constraints are what findOrCreateSeries/addSeriesItem in
// src/app/series/actions.ts actually rely on to be "find-or-create by
// normalised key" rather than a UI convention that could drift — a
// duplicate create must fail at the DB layer even if application code ever
// forgets to check first.
describe("series catalog uniqueness", () => {
  const userIds: string[] = [];
  const seriesIds: string[] = [];

  afterEach(async () => {
    for (const id of seriesIds) {
      await prisma.seriesClaim.deleteMany({ where: { seriesItem: { seriesId: id } } });
      await prisma.seriesItem.deleteMany({ where: { seriesId: id } });
      await prisma.series.delete({ where: { id } }).catch(() => {});
    }
    for (const id of userIds) {
      await prisma.user.delete({ where: { id } }).catch(() => {});
    }
    seriesIds.length = 0;
    userIds.length = 0;
  });

  async function makeUser() {
    const user = await prisma.user.create({
      data: { id: randomUUID(), email: `${randomUUID()}@example.com`, username: `u_${randomUUID().slice(0, 8)}` },
    });
    userIds.push(user.id);
    return user;
  }

  it("rejects a second series with the same normalised name key", async () => {
    const user = await makeUser();
    const name = "Dungeon Crawler Carl Blind Box Series";
    const series = await prisma.series.create({ data: { name, nameKey: normalizeSeriesKey(name), createdBy: user.id } });
    seriesIds.push(series.id);

    await expect(
      prisma.series.create({
        data: { name: "  dungeon crawler carl blind box series  ", nameKey: normalizeSeriesKey(name), createdBy: user.id },
      })
    ).rejects.toThrow();
  });

  it("rejects a second item in the same series with the same normalised label key, but allows it in a different series", async () => {
    const user = await makeUser();
    const seriesA = await prisma.series.create({ data: { name: "Series A", nameKey: `a-${randomUUID()}`, createdBy: user.id } });
    const seriesB = await prisma.series.create({ data: { name: "Series B", nameKey: `b-${randomUUID()}`, createdBy: user.id } });
    seriesIds.push(seriesA.id, seriesB.id);

    const label = "Donut";
    await prisma.seriesItem.create({
      data: { seriesId: seriesA.id, label, labelKey: normalizeSeriesKey(label), createdBy: user.id },
    });

    await expect(
      prisma.seriesItem.create({
        data: { seriesId: seriesA.id, label: "DONUT", labelKey: normalizeSeriesKey(label), createdBy: user.id },
      })
    ).rejects.toThrow();

    // Same label, different series — allowed, since the unique key is
    // scoped to (seriesId, labelKey).
    await expect(
      prisma.seriesItem.create({
        data: { seriesId: seriesB.id, label, labelKey: normalizeSeriesKey(label), createdBy: user.id },
      })
    ).resolves.toBeTruthy();
  });

  it("rejects a second claim on the same item by the same user, but allows a different user to claim it too", async () => {
    const owner = await makeUser();
    const claimant1 = await makeUser();
    const claimant2 = await makeUser();
    const series = await prisma.series.create({ data: { name: "Claim test", nameKey: `c-${randomUUID()}`, createdBy: owner.id } });
    seriesIds.push(series.id);
    const item = await prisma.seriesItem.create({
      data: { seriesId: series.id, label: "Item", labelKey: "item", createdBy: owner.id },
    });

    await prisma.seriesClaim.create({ data: { seriesItemId: item.id, userId: claimant1.id } });
    await expect(prisma.seriesClaim.create({ data: { seriesItemId: item.id, userId: claimant1.id } })).rejects.toThrow();
    await expect(
      prisma.seriesClaim.create({ data: { seriesItemId: item.id, userId: claimant2.id } })
    ).resolves.toBeTruthy();
  });
});
