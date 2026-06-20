import { beforeEach, describe, expect, it, vi } from "vitest";

const checkAllHistoryUpdatesMock = vi.fn();

vi.mock("@/modules/history", () => ({
  checkAllHistoryUpdates: checkAllHistoryUpdatesMock,
}));

describe("history cron route", () => {
  let route: typeof import("@/app/api/cron/history/route");

  beforeEach(() => {
    checkAllHistoryUpdatesMock.mockReset();
  });

  it("returns the update summary after the scheduled update check completes", async () => {
    route ??= await import("@/app/api/cron/history/route");
    const summary = { checked: 3, errors: 0, skipped: 1, updated: 2, users: 1 };
    let finishCheck: (() => void) | undefined;

    checkAllHistoryUpdatesMock.mockReturnValue(
      new Promise<typeof summary>((resolve) => {
        finishCheck = resolve;
      }).then(() => summary),
    );

    expect(route.runtime).toBe("nodejs");
    expect(route.maxDuration).toBe(120);

    const responsePromise = route.GET();
    const pendingResponse = await Promise.race([
      responsePromise,
      new Promise<"not returned">((resolve) => setTimeout(() => resolve("not returned"), 10)),
    ]);

    expect(pendingResponse).toBe("not returned");
    expect(checkAllHistoryUpdatesMock).toHaveBeenCalledTimes(1);

    finishCheck?.();
    const response = await responsePromise;

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      message: "History update check completed.",
      result: summary,
    });
  });
});
