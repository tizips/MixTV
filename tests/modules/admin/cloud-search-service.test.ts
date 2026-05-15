import { describe, expect, it, vi } from "vitest";
import {
  defaultCloudSearchConfig,
  getCloudSearchConfig,
  saveCloudSearchConfig,
  testCloudSearchConnection,
  type AdminModulesStore,
} from "@/modules/admin/server/cloud-search-service";

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

describe("cloud search service", () => {
  it("reads and saves cloud search config", async () => {
    const store = createFakeStore();
    await expect(getCloudSearchConfig(store)).resolves.toEqual({
      ...defaultCloudSearchConfig,
      requestTimeoutSeconds: 30,
      supportedDriveTypes: [],
    });

    const saved = await saveCloudSearchConfig(
      {
        enabled: false,
        panSouUrl: " http://so.252035.xyz ",
        requestTimeoutSeconds: 999,
        supportedDriveTypes: ["baidu", "bad", "guangya", "others"],
      },
      store,
    );

    expect(saved).toEqual({
      enabled: false,
      panSouUrl: "http://so.252035.xyz",
      requestTimeoutSeconds: 120,
      supportedDriveTypes: ["baidu", "guangya", "other"],
      updatedAt: saved.updatedAt,
    });
    expect(store.set).not.toHaveBeenCalledWith("cloud-search", expect.anything());
    expect(store.script).toHaveBeenCalledWith(expect.stringContaining("HSET"), {
      args: [
        "false",
        "http://so.252035.xyz",
        "120",
        JSON.stringify(["baidu", "guangya", "other"]),
        saved.updatedAt,
      ],
      keys: ["cloud-search"],
    });
    await expect(testCloudSearchConnection({ panSouUrl: "http://so.252035.xyz" })).resolves.toMatchObject({ ok: true });
  });

  it("reads cloud search config from a redis hash and defaults blank PanSou urls", async () => {
    const storedConfig = {
      enabled: false,
      panSouUrl: "",
      requestTimeoutSeconds: 8,
      supportedDriveTypes: ["baidu", "ali"],
      updatedAt: "2026-05-15T00:00:00.000Z",
    };
    const store = createFakeStore({}, {
      enabled: "false",
      panSouUrl: "",
      requestTimeoutSeconds: "8",
      supportedDriveTypes: JSON.stringify(["baidu", "ali"]),
      updatedAt: "2026-05-15T00:00:00.000Z",
    });

    await expect(getCloudSearchConfig(store)).resolves.toEqual({
      ...storedConfig,
      panSouUrl: defaultCloudSearchConfig.panSouUrl,
      supportedDriveTypes: ["baidu", "aliyun"],
    });

    expect(store.script).toHaveBeenCalledWith(expect.stringContaining("HGETALL"), {
      keys: ["cloud-search"],
      readOnly: true,
    });
    expect(store.get).not.toHaveBeenCalledWith("cloud-search");
    await expect(testCloudSearchConnection({ panSouUrl: " " })).resolves.toMatchObject({
      message: `PanSou endpoint accepted: ${defaultCloudSearchConfig.panSouUrl}`,
      ok: true,
    });
  });

  it("reads hgetall array responses", async () => {
    const arrayStore = {
      del: vi.fn(async () => undefined),
      get: vi.fn(async () => null),
      script: vi.fn(async <TResult = unknown>() => [
        "enabled",
        "false",
        "panSouUrl",
        "https://array.pansou.test",
        "requestTimeoutSeconds",
        "12",
        "supportedDriveTypes",
        JSON.stringify(["baidu", "ali"]),
        "updatedAt",
        "2026-05-15T02:00:00.000Z",
      ] as TResult) as AdminModulesStore["script"],
      set: vi.fn(async () => undefined),
    } satisfies AdminModulesStore;

    await expect(getCloudSearchConfig(arrayStore)).resolves.toEqual({
      enabled: false,
      panSouUrl: "https://array.pansou.test",
      requestTimeoutSeconds: 12,
      supportedDriveTypes: ["baidu", "aliyun"],
      updatedAt: "2026-05-15T02:00:00.000Z",
    });
    expect(arrayStore.get).not.toHaveBeenCalled();
  });
});
