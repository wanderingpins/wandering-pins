import { describe, expect, it } from "vitest";
import { withTimeout } from "./with-timeout";

describe("withTimeout", () => {
  it("resolves with the promise's value when it settles before the deadline", async () => {
    await expect(withTimeout(Promise.resolve("ok"), 50)).resolves.toBe("ok");
  });

  it('resolves to "timeout" when the promise is still pending past the deadline', async () => {
    const neverSettles = new Promise(() => {});
    await expect(withTimeout(neverSettles, 5)).resolves.toBe("timeout");
  });
});
