import { beforeEach, describe, expect, it, vi } from "vitest";
import * as route from "@/app/api/cron/history/check-updates/route";

const afterMock = vi.hoisted(() => vi.fn());
const checkAllHistoryUpdatesMock = vi.hoisted(() => vi.fn());

vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();

  return {
    ...actual,
    after: afterMock,
  };
});

vi.mock("@/modules/history", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/history")>();

  return {
    ...actual,
    checkAllHistoryUpdates: checkAllHistoryUpdatesMock,
  };
});

describe("history cron route", () => {
  beforeEach(() => {
    afterMock.mockReset();
    checkAllHistoryUpdatesMock.mockReset();
  });

  it("returns success immediately and schedules the background update check", async () => {
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
