import { beforeEach, describe, expect, it, vi } from "vitest";

const runConfigFilesSubscriptionAutoUpdateMock = vi.fn();

vi.mock("@/modules/admin", () => ({
  runConfigFilesSubscriptionAutoUpdate: runConfigFilesSubscriptionAutoUpdateMock,
}));

describe("subscription cron route", () => {
  let route: typeof import("@/app/api/cron/subscription/route");

  beforeEach(() => {
    runConfigFilesSubscriptionAutoUpdateMock.mockReset();
  });

  it("returns the update result after the scheduled subscription update completes", async () => {
    route ??= await import("@/app/api/cron/subscription/route");
    const result = {
      subscription: { autoUpdate: true, updatedAt: "2026-06-20T00:00:00.000Z", url: "https://example.com/config.json" },
      updated: true,
    };
    let finishUpdate: (() => void) | undefined;

    runConfigFilesSubscriptionAutoUpdateMock.mockReturnValue(
      new Promise<typeof result>((resolve) => {
        finishUpdate = resolve;
      }).then(() => result),
    );

    expect(route.runtime).toBe("nodejs");
    expect(route.maxDuration).toBe(120);

    const responsePromise = route.GET();
    const pendingResponse = await Promise.race([
      responsePromise,
      new Promise<"not returned">((resolve) => setTimeout(() => resolve("not returned"), 10)),
    ]);

    expect(pendingResponse).toBe("not returned");
    expect(runConfigFilesSubscriptionAutoUpdateMock).toHaveBeenCalledTimes(1);

    finishUpdate?.();
    const response = await responsePromise;

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      message: "Subscription update completed.",
      result,
    });
  });
});
