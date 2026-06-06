import { beforeEach, describe, expect, it, vi } from "vitest";

const afterMock = vi.fn();
const cleanupExpiredCacheKvEntriesMock = vi.fn();

vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();

  return {
    ...actual,
    after: afterMock,
  };
});

vi.mock("@/modules/admin/server/cache-management-service", () => ({
  cleanupExpiredCacheKvEntries: cleanupExpiredCacheKvEntriesMock,
}));

describe("cache cleanup cron route", () => {
  let route: typeof import("@/app/api/cron/cache-cleanup/route");

  beforeEach(() => {
    afterMock.mockReset();
    cleanupExpiredCacheKvEntriesMock.mockReset();
  });

  it("returns success immediately and schedules the cache cleanup", async () => {
    route ??= await import("@/app/api/cron/cache-cleanup/route");
    expect(route.runtime).toBe("nodejs");

    const response = await route.GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ message: "Cache cleanup scheduled." });
    expect(afterMock).toHaveBeenCalledTimes(1);

    const callback = afterMock.mock.calls[0]?.[0] as (() => Promise<void>) | undefined;

    expect(callback).toBeTypeOf("function");
    await callback?.();
    expect(cleanupExpiredCacheKvEntriesMock).toHaveBeenCalledTimes(1);
  });
});
