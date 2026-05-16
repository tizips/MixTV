import { describe, expect, it, vi } from "vitest";
import {
  defaultSiteConfig,
  getSiteConfig,
  saveSiteConfigLeft,
  saveSiteConfigSwitch,
  type SiteConfigStore,
} from "@/modules/admin/server/site-config-service";
import { env } from "@/shared/env";

const createFakeStore = (initial: Record<string, unknown> = {}, hashInitial: Record<string, string> = {}): SiteConfigStore => {
  const data = new Map(Object.entries(initial));
  const hash = new Map(Object.entries(hashInitial));
  const script: SiteConfigStore["script"] = async <TResult = unknown>(scriptText: string, options = {}) => {
    const runOptions = options as { args?: unknown[] };

    if (scriptText.includes("HGETALL")) {
      return Object.fromEntries(hash) as TResult;
    }

    if (scriptText.includes("HSET")) {
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
  };
  const scriptMock = vi.fn(script) as SiteConfigStore["script"];

  return {
    del: vi.fn(async () => undefined),
    get: vi.fn(async (key: string) => data.get(key) ?? null) as SiteConfigStore["get"],
    script: scriptMock,
    set: vi.fn(async (key: string, value: unknown) => {
      data.set(key, value);
    }) as SiteConfigStore["set"],
  };
};

describe("site config service", () => {
  it("returns defaults when no config has been saved", async () => {
    const store = createFakeStore();

    await expect(getSiteConfig(store)).resolves.toEqual(defaultSiteConfig);
    expect(store.script).toHaveBeenCalledWith(expect.stringContaining("HGETALL"), {
      keys: ["site"],
      readOnly: true,
    });
  });

  it("merges stored config over defaults", async () => {
    const store = createFakeStore({}, {
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
    const store = createFakeStore({}, {
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
    expect(store.set).not.toHaveBeenCalledWith("site", saved);
    expect(store.script).toHaveBeenCalledWith(expect.stringContaining("HSET"), {
      args: [
        "MixTV Pro",
        "公告",
        "custom",
        "https://proxy.example.test/data",
        "zwei",
        "",
        "token",
        "false",
        "true",
        "true",
        saved.updatedAt,
      ],
      keys: ["site"],
    });
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
    const store = createFakeStore({}, {
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
    expect(store.script).toHaveBeenCalledWith(expect.stringContaining("HSET"), {
      args: [
        "Current MixTV",
        "Current announcement",
        "zwei",
        "",
        "custom",
        "https://images.example.test",
        "token",
        "true",
        "false",
        "true",
        saved.updatedAt,
      ],
      keys: ["site"],
    });
  });

  it("updates a single switch by key", async () => {
    const store = createFakeStore({}, {
      showAdultContent: "false",
    });

    const saved = await saveSiteConfigSwitch("showAdultContent", true, store);

    expect(saved.showAdultContent).toBe(true);
    expect(saved.enableKeywordFilter).toBe(true);
    expect(saved.enableStreamingSearch).toBe(true);
    expect(store.script).toHaveBeenCalledWith(expect.stringContaining("HSET"), {
      args: [
        env.NEXT_PUBLIC_SITE_NAME,
        `欢迎来到 ${env.NEXT_PUBLIC_SITE_NAME}，请注意站点公告。`,
        "direct",
        "",
        "direct",
        "",
        "",
        "true",
        "true",
        "true",
        saved.updatedAt,
      ],
      keys: ["site"],
    });
  });

  it("reads hgetall array responses", async () => {
    const arrayStore = {
      del: vi.fn(async () => undefined) as SiteConfigStore["del"],
      get: vi.fn(async () => null) as SiteConfigStore["get"],
      script: vi.fn((async <TResult = unknown>() => [
        "siteName",
        "Array MixTV",
        "siteAnnouncement",
        "Array announcement",
        "doubanDataProxyMode",
        "custom",
        "doubanDataProxyUrl",
        "https://data.example.test",
        "doubanImageProxyMode",
        "zwei",
        "doubanImageProxyUrl",
        "https://image.example.test",
        "doubanAuth",
        "array-token",
        "enableKeywordFilter",
        "false",
        "showAdultContent",
        "true",
        "enableStreamingSearch",
        "false",
        "updatedAt",
        "2026-05-14T01:00:00.000Z",
      ] as TResult) as SiteConfigStore["script"]) as SiteConfigStore["script"],
      set: vi.fn(async () => undefined) as SiteConfigStore["set"],
    } satisfies SiteConfigStore;

    await expect(getSiteConfig(arrayStore)).resolves.toEqual({
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
    expect(arrayStore.get).not.toHaveBeenCalled();
  });
});
