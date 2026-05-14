import { describe, expect, it, vi } from "vitest";
import {
  clearCache,
  defaultCloudSearchConfig,
  defaultDanmakuConfig,
  defaultTimingManagementConfig,
  exportMigrationBackup,
  getCacheData,
  getCloudSearchConfig,
  getDanmakuConfig,
  getPerformanceMetrics,
  getTimingManagementConfig,
  importMigrationBackup,
  refreshCacheStats,
  saveCloudSearchConfig,
  saveDanmakuConfig,
  saveTimingManagementConfig,
  testCloudSearchConnection,
  testDanmakuConnection,
  type AdminModulesStore,
} from "@/modules/admin/server/admin-modules-service";

const createFakeStore = (initial: Record<string, unknown> = {}): AdminModulesStore => {
  const data = new Map(Object.entries(initial));

  return {
    del: vi.fn(async (key: string) => {
      data.delete(key);
    }),
    get: vi.fn(async (key: string) => data.get(key) ?? null),
    script: vi.fn(async <TResult = unknown>() => ({} as TResult)) as AdminModulesStore["script"],
    set: vi.fn(async (key: string, value: unknown) => {
      data.set(key, value);
    }),
  };
};

describe("admin modules service", () => {
  it("reads and saves cloud search config", async () => {
    const store = createFakeStore();
    await expect(getCloudSearchConfig(store)).resolves.toEqual(defaultCloudSearchConfig);

    const saved = await saveCloudSearchConfig(
      {
        enabled: false,
        panSouUrl: " http://pansou.test ",
        requestTimeoutSeconds: 999,
        supportedDriveTypes: ["baidu", "bad", "quark"],
      },
      store,
    );

    expect(saved).toEqual({
      enabled: false,
      panSouUrl: "http://pansou.test",
      requestTimeoutSeconds: 120,
      supportedDriveTypes: ["baidu", "quark"],
      updatedAt: saved.updatedAt,
    });
    await expect(testCloudSearchConnection({ panSouUrl: "http://pansou.test" })).resolves.toMatchObject({ ok: true });
  });

  it("reads and saves danmaku config", async () => {
    const store = createFakeStore();
    await expect(getDanmakuConfig(store)).resolves.toEqual(defaultDanmakuConfig);

    const saved = await saveDanmakuConfig(
      {
        enabled: true,
        apiUrl: " https://danmaku.test ",
        apiToken: " token ",
        requestTimeoutSeconds: 0,
      },
      store,
    );

    expect(saved.apiUrl).toBe("https://danmaku.test");
    expect(saved.apiToken).toBe("token");
    expect(saved.requestTimeoutSeconds).toBe(1);
    await expect(testDanmakuConnection({ apiUrl: "https://danmaku.test" })).resolves.toMatchObject({ ok: true });
  });

  it("reads and saves timing management config", async () => {
    const store = createFakeStore();
    await expect(getTimingManagementConfig(store)).resolves.toEqual(defaultTimingManagementConfig);

    const saved = await saveTimingManagementConfig(
      {
        autoRefreshEnabled: false,
        maxRecordsPerRun: 2000,
        recentActiveDays: 0,
        onlyRefreshOngoingSeries: false,
        maxSearchPages: 25,
        siteCacheSeconds: -1,
      },
      store,
    );

    expect(saved).toMatchObject({
      autoRefreshEnabled: false,
      maxRecordsPerRun: 1000,
      recentActiveDays: 1,
      onlyRefreshOngoingSeries: false,
      maxSearchPages: 20,
      siteCacheSeconds: 0,
    });
  });

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

  it("exports and imports migration backups", async () => {
    await expect(exportMigrationBackup({ password: "secret" })).resolves.toMatchObject({
      app: "MixTV",
      version: 1,
    });
    await expect(importMigrationBackup({ password: "secret" })).resolves.toMatchObject({
      message: "Backup import accepted.",
    });
  });

  it("returns performance metrics", async () => {
    const result = await getPerformanceMetrics();

    expect(result.checkedAt).toEqual(expect.any(String));
    expect(result.metrics.map((metric) => metric.key)).toContain("request");
  });
});
