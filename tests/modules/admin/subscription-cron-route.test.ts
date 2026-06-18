import { beforeEach, describe, expect, it, vi } from "vitest";

const runConfigFilesSubscriptionAutoUpdateMock = vi.fn();
const waitForBackgroundTask = () => new Promise((resolve) => setTimeout(resolve, 0));

vi.mock("@/modules/admin", () => ({
  runConfigFilesSubscriptionAutoUpdate: runConfigFilesSubscriptionAutoUpdateMock,
}));

describe("subscription cron route", () => {
  let route: typeof import("@/app/api/cron/subscription/route");

  beforeEach(() => {
    runConfigFilesSubscriptionAutoUpdateMock.mockReset();
  });

  it("returns success before running the background subscription update", async () => {
    route ??= await import("@/app/api/cron/subscription/route");
    let finishUpdate: (() => void) | undefined;

    runConfigFilesSubscriptionAutoUpdateMock.mockReturnValue(
      new Promise<void>((resolve) => {
        finishUpdate = resolve;
      }),
    );

    const responsePromise = route.GET();
    const response = await Promise.race([
      responsePromise,
      new Promise<"not returned">((resolve) => setTimeout(() => resolve("not returned"), 10)),
    ]);

    if (!(response instanceof Response)) {
      throw new Error("subscription cron response did not return before the background task finished.");
    }

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ message: "Subscription update scheduled." });
    expect(runConfigFilesSubscriptionAutoUpdateMock).not.toHaveBeenCalled();

    await waitForBackgroundTask();
    expect(runConfigFilesSubscriptionAutoUpdateMock).toHaveBeenCalledTimes(1);
    finishUpdate?.();
  });
});
