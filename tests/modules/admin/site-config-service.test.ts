import { describe, expect, it, vi } from "vitest";
import {
  defaultSiteConfig,
  getSiteConfig,
  saveSiteConfigLeft,
  saveSiteConfigSwitch,
  type SiteConfigStore,
} from "@/modules/admin/server/site-config-service";

const createFakeStore = (overrides: Partial<SiteConfigStore> = {}): SiteConfigStore => ({
  del: vi.fn(async () => undefined),
  get: vi.fn(async () => null),
  script: vi.fn(async <TResult = unknown>() => ({} as TResult)) as SiteConfigStore["script"],
  set: vi.fn(async () => undefined),
  ...overrides,
});

describe("site config service", () => {
  it("returns defaults when no config has been saved", async () => {
    const store = createFakeStore();

    await expect(getSiteConfig(store)).resolves.toEqual(defaultSiteConfig);
    expect(store.get).toHaveBeenCalledWith("config");
  });

  it("merges stored config over defaults", async () => {
    const store = createFakeStore({
      get: vi.fn(async () => ({
        ...defaultSiteConfig,
        siteName: "Custom TV",
        enableStreamingSearch: false,
        updatedAt: "2026-05-14T00:00:00.000Z",
      })),
    });

    await expect(getSiteConfig(store)).resolves.toEqual({
      ...defaultSiteConfig,
      siteName: "Custom TV",
      enableStreamingSearch: false,
      updatedAt: "2026-05-14T00:00:00.000Z",
    });
  });

  it("saves left panel fields without changing switches", async () => {
    const store = createFakeStore({
      get: vi.fn(async () => ({
        ...defaultSiteConfig,
        enableKeywordFilter: false,
        showAdultContent: true,
      })),
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
    expect(store.set).toHaveBeenCalledWith("config", saved);
  });

  it("rejects invalid proxy modes", async () => {
    const store = createFakeStore();

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
    expect(store.set).not.toHaveBeenCalled();
  });

  it("preserves disabled site text fields when saving main config", async () => {
    const store = createFakeStore({
      get: vi.fn(async () => ({
        ...defaultSiteConfig,
        siteName: "Current MixTV",
        siteAnnouncement: "Current announcement",
      })),
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
    expect(store.set).toHaveBeenCalledWith("config", saved);
  });

  it("updates a single switch by key", async () => {
    const store = createFakeStore({
      get: vi.fn(async () => ({
        ...defaultSiteConfig,
        showAdultContent: false,
      })),
    });

    const saved = await saveSiteConfigSwitch("showAdultContent", true, store);

    expect(saved.showAdultContent).toBe(true);
    expect(saved.enableKeywordFilter).toBe(true);
    expect(saved.enableStreamingSearch).toBe(true);
    expect(store.set).toHaveBeenCalledWith("config", saved);
  });
});
