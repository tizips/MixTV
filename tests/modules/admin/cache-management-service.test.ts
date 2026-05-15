import { describe, expect, it, vi } from "vitest";
import {
  clearCache,
  getCacheData,
  refreshCacheStats,
  type AdminModulesStore,
} from "@/modules/admin/server/cache-management-service";

const createFakeStore = (initial: Record<string, unknown> = {}): AdminModulesStore => {
  const data = new Map(Object.entries(initial));

  return {
    del: vi.fn(async (key: string) => {
      data.delete(key);
    }),
    get: vi.fn(async (key: string) => data.get(key) ?? null),
    script: vi.fn(async () => ({})) as AdminModulesStore["script"],
    set: vi.fn(async (key: string, value: unknown) => {
      data.set(key, value);
    }),
  };
};

describe("cache management service", () => {
  it("reads, refreshes, and clears cache data", async () => {
    const store = createFakeStore();
    const cache = await getCacheData(store);
    expect(cache.categories.length).toBeGreaterThan(0);

    const refreshed = await refreshCacheStats(store);
    expect(refreshed.updatedAt).toEqual(expect.any(String));

    const clearedOne = await clearCache({ key: "douban" }, store);
    expect(clearedOne.categories.find((category) => category.key === "douban")).toMatchObject({ items: 0, sizeKb: 0 });

    const clearedAll = await clearCache({ key: null }, store);
    expect(clearedAll.categories.every((category) => category.items === 0 && category.sizeKb === 0)).toBe(true);
  });
});
