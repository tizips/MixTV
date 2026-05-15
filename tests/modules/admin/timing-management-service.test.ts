import { describe, expect, it, vi } from "vitest";
import {
  defaultTimingManagementConfig,
  getTimingManagementConfig,
  saveTimingManagementConfig,
  type AdminModulesStore,
} from "@/modules/admin/server/timing-management-service";

const createFakeStore = (initial: Record<string, unknown> = {}, hashInitial: Record<string, string> = {}): AdminModulesStore => {
  const data = new Map(Object.entries(initial));
  const hash = new Map(Object.entries(hashInitial));

  return {
    del: vi.fn(async (key: string) => {
      data.delete(key);
    }),
    get: vi.fn(async (key: string) => data.get(key) ?? null),
    script: vi.fn(async <TResult = unknown>(script: string, options = {}) => {
      const runOptions = options as { args?: unknown[] };

      if (script.includes("HGETALL")) {
        return Object.fromEntries(hash) as TResult;
      }

      if (script.includes("HSET")) {
        const args = runOptions.args ?? [];

        for (let index = 0; index < args.length; index += 2) {
          const field = args[index];
          const value = args[index + 1];

          if (typeof field === "string" && typeof value === "string") {
            hash.set(field, value);
          }
        }

        return 1 as TResult;
      }

      return {} as TResult;
    }) as AdminModulesStore["script"],
    set: vi.fn(async (key: string, value: unknown) => {
      data.set(key, value);
    }),
  };
};

describe("timing management service", () => {
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
    expect(store.get).not.toHaveBeenCalledWith("timing-management");
    expect(store.set).not.toHaveBeenCalledWith("timing-management", expect.anything());
    expect(store.script).toHaveBeenCalledWith(expect.stringContaining("HSET"), {
      args: [
        "false",
        "1000",
        "1",
        "false",
        "20",
        "0",
        saved.updatedAt,
      ],
      keys: ["timing-management"],
    });
  });

  it("reads timing management config from the redis hash", async () => {
    const store = createFakeStore({}, {
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
    expect(store.script).toHaveBeenCalledWith(expect.stringContaining("HGETALL"), {
      keys: ["timing-management"],
      readOnly: true,
    });
    expect(store.get).not.toHaveBeenCalled();
  });

  it("reads timing management config from hgetall array responses", async () => {
    const store = {
      del: vi.fn(async () => undefined),
      get: vi.fn(async () => null),
      script: vi.fn(async <TResult = unknown>() => [
        "autoRefreshEnabled",
        "false",
        "maxRecordsPerRun",
        "333",
        "recentActiveDays",
        "60",
        "onlyRefreshOngoingSeries",
        "true",
        "maxSearchPages",
        "6",
        "siteCacheSeconds",
        "1800",
        "updatedAt",
        "2026-05-15T01:00:00.000Z",
      ] as TResult) as AdminModulesStore["script"],
      set: vi.fn(async () => undefined),
    } satisfies AdminModulesStore;

    await expect(getTimingManagementConfig(store)).resolves.toEqual({
      autoRefreshEnabled: false,
      maxRecordsPerRun: 333,
      recentActiveDays: 60,
      onlyRefreshOngoingSeries: true,
      maxSearchPages: 6,
      siteCacheSeconds: 1800,
      updatedAt: "2026-05-15T01:00:00.000Z",
    });
    expect(store.get).not.toHaveBeenCalled();
  });
});
