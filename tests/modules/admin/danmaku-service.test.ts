import { describe, expect, it } from "vitest";
import {
  defaultDanmakuConfig,
  getDanmakuConfig,
  saveDanmakuConfig,
  testDanmakuConnection,
  type AdminModulesStore,
} from "@/modules/admin/server/danmaku-service";
import {
  createEdgeOneKvHashStore,
  dumpEdgeOneKvHash,
} from "../../helpers/fake-edgeone-kv";

const danmakuKey = "danmaku";

function createFakeStore(hashInitial: Record<string, string> = {}): Promise<AdminModulesStore> {
  return createEdgeOneKvHashStore({
    [danmakuKey]: hashInitial,
  }, { namespace: "admin" });
}

describe("danmaku service", () => {
  it("reads and saves danmaku config", async () => {
    const store = await createFakeStore();
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
    await expect(dumpEdgeOneKvHash(store, danmakuKey, { namespace: "admin" })).resolves.toMatchObject({
      enabled: "true",
      apiUrl: "https://danmaku.test",
      apiToken: "token",
      requestTimeoutSeconds: "1",
      updatedAt: saved.updatedAt,
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

    const hashStore = await createFakeStore({
      enabled: "false",
      apiUrl: "https://hash.danmaku.test",
      apiToken: "hash-token",
      requestTimeoutSeconds: "8",
      updatedAt: "2026-05-15T00:00:00.000Z",
    });
    await expect(getDanmakuConfig(hashStore)).resolves.toEqual(storedConfig);
  });

  it("reads danmaku config from stored hash values", async () => {
    const store = await createFakeStore({
      enabled: "false",
      apiUrl: "https://array.danmaku.test",
      apiToken: "array-token",
      requestTimeoutSeconds: "12",
      updatedAt: "2026-05-15T01:00:00.000Z",
    });

    await expect(getDanmakuConfig(store)).resolves.toEqual({
      enabled: false,
      apiUrl: "https://array.danmaku.test",
      apiToken: "array-token",
      requestTimeoutSeconds: 12,
      updatedAt: "2026-05-15T01:00:00.000Z",
    });
  });
});
