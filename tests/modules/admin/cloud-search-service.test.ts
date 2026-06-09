import { describe, expect, it } from "vitest";
import {
  defaultCloudSearchConfig,
  getCloudSearchConfig,
  saveCloudSearchConfig,
  testCloudSearchConnection,
  type AdminModulesStore,
} from "@/modules/admin/server/cloud-search-service";
import {
  createEdgeOneKvHashStore,
  dumpEdgeOneKvHash,
} from "../../helpers/fake-edgeone-kv";

const cloudSearchKey = "cloud-search";

function createFakeStore(hashInitial: Record<string, string> = {}): Promise<AdminModulesStore> {
  return createEdgeOneKvHashStore({
    [cloudSearchKey]: hashInitial,
  }, { namespace: "admin" });
}

describe("cloud search service", () => {
  it("reads and saves cloud search config", async () => {
    const store = await createFakeStore();
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
    await expect(dumpEdgeOneKvHash(store, cloudSearchKey, { namespace: "admin" })).resolves.toMatchObject({
      enabled: "false",
      panSouUrl: "http://so.252035.xyz",
      requestTimeoutSeconds: "120",
      supportedDriveTypes: JSON.stringify(["baidu", "guangya", "other"]),
      updatedAt: saved.updatedAt,
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
    const store = await createFakeStore({
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

    await expect(testCloudSearchConnection({ panSouUrl: " " })).resolves.toMatchObject({
      message: `PanSou endpoint accepted: ${defaultCloudSearchConfig.panSouUrl}`,
      ok: true,
    });
  });

  it("reads stored hash values", async () => {
    const store = await createFakeStore({
      enabled: "false",
      panSouUrl: "https://array.pansou.test",
      requestTimeoutSeconds: "12",
      supportedDriveTypes: JSON.stringify(["baidu", "ali"]),
      updatedAt: "2026-05-15T02:00:00.000Z",
    });

    await expect(getCloudSearchConfig(store)).resolves.toEqual({
      enabled: false,
      panSouUrl: "https://array.pansou.test",
      requestTimeoutSeconds: 12,
      supportedDriveTypes: ["baidu", "aliyun"],
      updatedAt: "2026-05-15T02:00:00.000Z",
    });
  });
});
