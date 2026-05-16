import * as nextServer from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const afterMock = vi.fn();
const runConfigFilesSubscriptionAutoUpdateMock = vi.fn();

vi.spyOn(nextServer, "after").mockImplementation(afterMock as never);

vi.mock("@/modules/admin", () => ({
  runConfigFilesSubscriptionAutoUpdate: runConfigFilesSubscriptionAutoUpdateMock,
}));

describe("subscription cron route", () => {
  let route: typeof import("@/app/api/cron/subscription/route");

  beforeEach(() => {
    afterMock.mockReset();
    runConfigFilesSubscriptionAutoUpdateMock.mockReset();
  });

  it("returns success immediately and schedules the background subscription update", async () => {
    route ??= await import("@/app/api/cron/subscription/route");
    const response = await route.GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ message: "Subscription update scheduled." });
    expect(afterMock).toHaveBeenCalledTimes(1);

    const callback = afterMock.mock.calls[0]?.[0] as (() => Promise<void>) | undefined;

    expect(callback).toBeTypeOf("function");
    await callback?.();
    expect(runConfigFilesSubscriptionAutoUpdateMock).toHaveBeenCalledTimes(1);
  });
});
