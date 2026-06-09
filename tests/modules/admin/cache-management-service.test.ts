import { describe, expect, it } from "vitest";
import {
  clearCache,
  cleanupExpiredCacheKvEntries,
  getCacheData,
  refreshCacheStats,
  type AdminModulesStore,
} from "@/modules/admin/server/cache-management-service";
import { writeEdgeOneKvString } from "@/infrastructure/db/edgeone-kv-db-adapter";
import { FakeEdgeOneKvBinding } from "../../helpers/fake-edgeone-kv";

const createFakeStore = (): AdminModulesStore => new FakeEdgeOneKvBinding();

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

  it("cleans expired records from the cache KV namespace", async () => {
    const currentTime = 1768435200000;
    const store = createFakeStore();
    await writeEdgeOneKvString(store, "expired:one", "old", {
      now: () => currentTime - 2000,
      ttlSeconds: 1,
    });
    await writeEdgeOneKvString(store, "expired:two", "old", {
      now: () => currentTime - 2000,
      ttlSeconds: 1,
    });
    await writeEdgeOneKvString(store, "active:one", "fresh", {
      now: () => currentTime,
      ttlSeconds: 1,
    });
    await writeEdgeOneKvString(store, "active:two", "fresh", {
      now: () => currentTime,
      ttlSeconds: 1,
    });

    await expect(cleanupExpiredCacheKvEntries({ now: () => currentTime, store })).resolves.toEqual({
      completedAt: "2026-01-15T00:00:00.000Z",
      deleted: 2,
      scanned: 4,
    });
  });
});
