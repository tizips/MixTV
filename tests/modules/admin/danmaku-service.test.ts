import { describe, expect, it, vi } from "vitest";
import {
  defaultDanmakuConfig,
  getDanmakuConfig,
  saveDanmakuConfig,
  testDanmakuConnection,
  type AdminModulesStore,
} from "@/modules/admin/server/danmaku-service";

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

describe("danmaku service", () => {
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
    expect(store.set).not.toHaveBeenCalledWith("danmaku", expect.anything());
    expect(store.script).toHaveBeenCalledWith(expect.stringContaining("HSET"), {
      args: [
        "true",
        "https://danmaku.test",
        "token",
        "1",
        saved.updatedAt,
      ],
      keys: ["danmaku"],
    });
    await expect(testDanmakuConnection({ apiUrl: "https://danmaku.test" })).resolves.toMatchObject({ ok: true });
  });

  it("reads danmaku config from the redis hash", async () => {
    const storedConfig = {
      enabled: false,
      apiUrl: "https://hash.danmaku.test",
      apiToken: "hash-token",
      requestTimeoutSeconds: 8,
      updatedAt: "2026-05-15T00:00:00.000Z",
    };

    const hashStore = createFakeStore({}, {
      enabled: "false",
      apiUrl: "https://hash.danmaku.test",
      apiToken: "hash-token",
      requestTimeoutSeconds: "8",
      updatedAt: "2026-05-15T00:00:00.000Z",
    });
    await expect(getDanmakuConfig(hashStore)).resolves.toEqual(storedConfig);
    expect(hashStore.script).toHaveBeenCalledWith(expect.stringContaining("HGETALL"), {
      keys: ["danmaku"],
      readOnly: true,
    });
    expect(hashStore.get).not.toHaveBeenCalled();
  });

  it("reads danmaku config from hgetall array responses", async () => {
    const store = {
      del: vi.fn(async () => undefined),
      get: vi.fn(async () => null),
      script: vi.fn(async <TResult = unknown>() => [
        "enabled",
        "false",
        "apiUrl",
        "https://array.danmaku.test",
        "apiToken",
        "array-token",
        "requestTimeoutSeconds",
        "12",
        "updatedAt",
        "2026-05-15T01:00:00.000Z",
      ] as TResult) as AdminModulesStore["script"],
      set: vi.fn(async () => undefined),
    } satisfies AdminModulesStore;

    await expect(getDanmakuConfig(store)).resolves.toEqual({
      enabled: false,
      apiUrl: "https://array.danmaku.test",
      apiToken: "array-token",
      requestTimeoutSeconds: 12,
      updatedAt: "2026-05-15T01:00:00.000Z",
    });
  });
});
