import { beforeEach, describe, expect, it, vi } from "vitest";

const checkAllHistoryUpdatesMock = vi.fn();
const waitForBackgroundTask = () => new Promise((resolve) => setTimeout(resolve, 0));

vi.mock("@/modules/history", () => ({
  checkAllHistoryUpdates: checkAllHistoryUpdatesMock,
}));

describe("history cron route", () => {
  let route: typeof import("@/app/api/cron/history/route");

  beforeEach(() => {
    checkAllHistoryUpdatesMock.mockReset();
  });

  it("returns success before running the background update check", async () => {
    route ??= await import("@/app/api/cron/history/route");
    let finishCheck: (() => void) | undefined;

    checkAllHistoryUpdatesMock.mockReturnValue(
      new Promise<void>((resolve) => {
        finishCheck = resolve;
      }),
    );

    const responsePromise = route.GET();
    const response = await Promise.race([
      responsePromise,
      new Promise<"not returned">((resolve) => setTimeout(() => resolve("not returned"), 10)),
    ]);

    if (!(response instanceof Response)) {
      throw new Error("history cron response did not return before the background task finished.");
    }

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ message: "History update check scheduled." });
    expect(checkAllHistoryUpdatesMock).not.toHaveBeenCalled();

    await waitForBackgroundTask();
    expect(checkAllHistoryUpdatesMock).toHaveBeenCalledTimes(1);
    finishCheck?.();
  });
});
