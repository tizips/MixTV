import { beforeEach, describe, expect, it, vi } from "vitest";

const afterMock = vi.fn();
const checkAllHistoryUpdatesMock = vi.fn();

vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();

  return {
    ...actual,
    after: afterMock,
  };
});

vi.mock("@/modules/history", () => ({
  checkAllHistoryUpdates: checkAllHistoryUpdatesMock,
}));

describe("history cron route", () => {
  let route: typeof import("@/app/api/cron/history/route");

  beforeEach(() => {
    afterMock.mockReset();
    checkAllHistoryUpdatesMock.mockReset();
  });

  it("returns success immediately and schedules the background update check", async () => {
    route ??= await import("@/app/api/cron/history/route");
    const response = await route.GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ message: "History update check scheduled." });
    expect(afterMock).toHaveBeenCalledTimes(1);

    const callback = afterMock.mock.calls[0]?.[0] as (() => Promise<void>) | undefined;

    expect(callback).toBeTypeOf("function");
    await callback?.();
    expect(checkAllHistoryUpdatesMock).toHaveBeenCalledTimes(1);
  });
});
