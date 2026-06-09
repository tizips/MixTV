import { describe, expect, it } from "vitest";
import {
  defaultTimingManagementConfig,
  getTimingManagementConfig,
  saveTimingManagementConfig,
  type AdminModulesStore,
} from "@/modules/admin/server/timing-management-service";
import {
  createEdgeOneKvHashStore,
  dumpEdgeOneKvHash,
} from "../../helpers/fake-edgeone-kv";

const timingManagementKey = "timing-management";

function createFakeStore(hashInitial: Record<string, string> = {}): Promise<AdminModulesStore> {
  return createEdgeOneKvHashStore({
    [timingManagementKey]: hashInitial,
  }, { namespace: "admin" });
}

describe("timing management service", () => {
  it("reads and saves timing management config", async () => {
    const store = await createFakeStore();
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
    await expect(dumpEdgeOneKvHash(store, timingManagementKey, { namespace: "admin" })).resolves.toMatchObject({
      autoRefreshEnabled: "false",
      maxRecordsPerRun: "1000",
      recentActiveDays: "1",
      onlyRefreshOngoingSeries: "false",
      maxSearchPages: "20",
      siteCacheSeconds: "0",
      updatedAt: saved.updatedAt,
    });
  });

  it("reads timing management config from the redis hash", async () => {
    const store = await createFakeStore({
      autoRefreshEnabled: "false",
      maxRecordsPerRun: "250",
      recentActiveDays: "45",
      onlyRefreshOngoingSeries: "false",
      maxSearchPages: "5",
      siteCacheSeconds: "7200",
      updatedAt: "2026-05-15T00:00:00.000Z",
    });

    await expect(getTimingManagementConfig(store)).resolves.toEqual({
      autoRefreshEnabled: false,
      maxRecordsPerRun: 250,
      recentActiveDays: 45,
      onlyRefreshOngoingSeries: false,
      maxSearchPages: 5,
      siteCacheSeconds: 7200,
      updatedAt: "2026-05-15T00:00:00.000Z",
    });
  });

  it("reads timing management config from stored hash values", async () => {
    const store = await createFakeStore({
      autoRefreshEnabled: "false",
      maxRecordsPerRun: "333",
      recentActiveDays: "60",
      onlyRefreshOngoingSeries: "true",
      maxSearchPages: "6",
      siteCacheSeconds: "1800",
      updatedAt: "2026-05-15T01:00:00.000Z",
    });

    await expect(getTimingManagementConfig(store)).resolves.toEqual({
      autoRefreshEnabled: false,
      maxRecordsPerRun: 333,
      recentActiveDays: 60,
      onlyRefreshOngoingSeries: true,
      maxSearchPages: 6,
      siteCacheSeconds: 1800,
      updatedAt: "2026-05-15T01:00:00.000Z",
    });
  });
});
