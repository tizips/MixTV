import { describe, expect, it } from "vitest";
import {
  defaultSiteConfig,
  getSiteConfig,
  saveSiteConfigLeft,
  saveSiteConfigSwitch,
  type SiteConfigStore,
} from "@/modules/admin/server/site-config-service";
import {
  createEdgeOneKvHashStore,
  dumpEdgeOneKvHash,
} from "../../helpers/fake-edgeone-kv";

const siteConfigKey = "site";

function createFakeStore(hashInitial: Record<string, string> = {}): Promise<SiteConfigStore> {
  return createEdgeOneKvHashStore({
    [siteConfigKey]: hashInitial,
  }, { namespace: "admin" });
}

describe("site config service", () => {
  it("returns defaults when no config has been saved", async () => {
    const store = await createFakeStore();

    await expect(getSiteConfig(store)).resolves.toEqual(defaultSiteConfig);
  });

  it("merges stored config over defaults", async () => {
    const store = await createFakeStore({
      siteName: "Custom TV",
      enableStreamingSearch: "false",
      updatedAt: "2026-05-14T00:00:00.000Z",
    });

    await expect(getSiteConfig(store)).resolves.toEqual({
      ...defaultSiteConfig,
      siteName: "Custom TV",
      enableStreamingSearch: false,
      updatedAt: "2026-05-14T00:00:00.000Z",
    });
  });

  it("saves left panel fields without changing switches", async () => {
    const store = await createFakeStore({
      enableKeywordFilter: "false",
      showAdultContent: "true",
    });

    const saved = await saveSiteConfigLeft(
      {
        siteName: " MixTV Pro ",
        siteAnnouncement: " 公告 ",
        doubanDataProxyMode: "custom",
        doubanDataProxyUrl: " https://proxy.example.test/data ",
        doubanImageProxyMode: "zwei",
        doubanImageProxyUrl: "",
        doubanAuth: " token ",
      },
      store,
    );

    expect(saved).toEqual({
      ...defaultSiteConfig,
      siteName: "MixTV Pro",
      siteAnnouncement: "公告",
      doubanDataProxyMode: "custom",
      doubanDataProxyUrl: "https://proxy.example.test/data",
      doubanImageProxyMode: "zwei",
      doubanImageProxyUrl: "",
      doubanAuth: "token",
      enableKeywordFilter: false,
      showAdultContent: true,
      updatedAt: saved.updatedAt,
    });
    expect(saved.updatedAt).toEqual(expect.any(String));
    await expect(dumpEdgeOneKvHash(store, siteConfigKey, { namespace: "admin" })).resolves.toMatchObject({
      siteName: "MixTV Pro",
      siteAnnouncement: "公告",
      doubanDataProxyMode: "custom",
      doubanDataProxyUrl: "https://proxy.example.test/data",
      doubanImageProxyMode: "zwei",
      doubanImageProxyUrl: "",
      doubanAuth: "token",
      enableKeywordFilter: "false",
      showAdultContent: "true",
      enableStreamingSearch: "true",
      updatedAt: saved.updatedAt,
    });
  });

  it("rejects invalid proxy modes", async () => {
    const store = await createFakeStore();

    await expect(
      saveSiteConfigLeft(
        {
          siteName: "MixTV",
          siteAnnouncement: "",
          doubanDataProxyMode: "bad",
          doubanDataProxyUrl: "",
          doubanImageProxyMode: "direct",
          doubanImageProxyUrl: "",
          doubanAuth: "",
        },
        store,
      ),
    ).rejects.toThrow("doubanDataProxyMode is invalid.");
    await expect(dumpEdgeOneKvHash(store, siteConfigKey, { namespace: "admin" })).resolves.toEqual({});
  });

  it("preserves disabled site text fields when saving main config", async () => {
    const store = await createFakeStore({
      siteName: "Current MixTV",
      siteAnnouncement: "Current announcement",
    });

    const saved = await saveSiteConfigLeft(
      {
        doubanDataProxyMode: "zwei",
        doubanDataProxyUrl: "",
        doubanImageProxyMode: "custom",
        doubanImageProxyUrl: " https://images.example.test ",
        doubanAuth: " token ",
      },
      store,
    );

    expect(saved.siteName).toBe("Current MixTV");
    expect(saved.siteAnnouncement).toBe("Current announcement");
    expect(saved.doubanDataProxyMode).toBe("zwei");
    expect(saved.doubanImageProxyMode).toBe("custom");
    expect(saved.doubanImageProxyUrl).toBe("https://images.example.test");
    expect(saved.doubanAuth).toBe("token");
    await expect(dumpEdgeOneKvHash(store, siteConfigKey, { namespace: "admin" })).resolves.toMatchObject({
      siteName: "Current MixTV",
      siteAnnouncement: "Current announcement",
      doubanDataProxyMode: "zwei",
      doubanImageProxyMode: "custom",
      doubanImageProxyUrl: "https://images.example.test",
      doubanAuth: "token",
      updatedAt: saved.updatedAt,
    });
  });

  it("updates a single switch by key", async () => {
    const store = await createFakeStore({
      showAdultContent: "false",
    });

    const saved = await saveSiteConfigSwitch("showAdultContent", true, store);

    expect(saved.showAdultContent).toBe(true);
    expect(saved.enableKeywordFilter).toBe(true);
    expect(saved.enableStreamingSearch).toBe(true);
    await expect(dumpEdgeOneKvHash(store, siteConfigKey, { namespace: "admin" })).resolves.toMatchObject({
      enableKeywordFilter: "true",
      showAdultContent: "true",
      enableStreamingSearch: "true",
      updatedAt: saved.updatedAt,
    });
  });

  it("reads stored hash values", async () => {
    const store = await createFakeStore({
      siteName: "Array MixTV",
      siteAnnouncement: "Array announcement",
      doubanDataProxyMode: "custom",
      doubanDataProxyUrl: "https://data.example.test",
      doubanImageProxyMode: "zwei",
      doubanImageProxyUrl: "https://image.example.test",
      doubanAuth: "array-token",
      enableKeywordFilter: "false",
      showAdultContent: "true",
      enableStreamingSearch: "false",
      updatedAt: "2026-05-14T01:00:00.000Z",
    });

    await expect(getSiteConfig(store)).resolves.toEqual({
      siteName: "Array MixTV",
      siteAnnouncement: "Array announcement",
      doubanDataProxyMode: "custom",
      doubanDataProxyUrl: "https://data.example.test",
      doubanImageProxyMode: "zwei",
      doubanImageProxyUrl: "https://image.example.test",
      doubanAuth: "array-token",
      enableKeywordFilter: false,
      showAdultContent: true,
      enableStreamingSearch: false,
      updatedAt: "2026-05-14T01:00:00.000Z",
    });
  });
});
