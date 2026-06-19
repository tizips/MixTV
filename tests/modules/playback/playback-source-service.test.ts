import { describe, expect, it, vi } from "vitest";
import type { VideoSourceResource } from "@/integrations/video-sources";
import type { SiteConfigStore } from "@/modules/admin/server/site-config-service";
import type { VideoSourceStore } from "@/modules/admin/server/video-source-service";
import {
  getPlaybackSources,
} from "@/modules/playback/server/playback-source-service";
import { createPlaybackSourcesCacheKey } from "@/modules/playback/server/playback-cache";
import type { DbPort, DbScriptOptions } from "@/shared/db/db-port";

type HashStore = DbPort<unknown, string> & {
  dumpHash: (key: string) => Record<string, string>;
};

type ValueStore = DbPort<unknown, string> & {
  dumpValue: (key: string) => string | null;
};

function createHashStore(initialValues: Record<string, Record<string, string>> = {}): HashStore {
  const values = new Map(Object.entries(initialValues).map(([key, record]) => [key, { ...record }]));
  const script: HashStore["script"] = async <TResult = unknown>(scriptText: string, options: DbScriptOptions<string> = {}) => {
    const key = options.keys?.[0] ?? "";
    const field = String(options.args?.[0] ?? "");
    const value = String(options.args?.[1] ?? "");
    const hash = values.get(key) ?? {};

    if (scriptText.includes("HGETALL")) {
      return hash as TResult;
    }

    if (scriptText.includes("HSET")) {
      for (let index = 0; index < (options.args ?? []).length - 1; index += 2) {
        const currentField = options.args?.[index];
        const currentValue = options.args?.[index + 1];

        if (typeof currentField === "string" && typeof currentValue === "string") {
          hash[currentField] = currentValue;
        }
      }
      values.set(key, hash);
      return value as TResult;
    }

    if (scriptText.includes("HDEL")) {
      delete hash[field];
      if (Object.keys(hash).length === 0) {
        values.delete(key);
      } else {
        values.set(key, hash);
      }
      return 1 as TResult;
    }

    if (scriptText.includes("DEL")) {
      values.delete(key);
      return 1 as TResult;
    }

    return null as TResult;
  };

  return {
    del: vi.fn(async () => undefined),
    dumpHash(key) {
      return { ...(values.get(key) ?? {}) };
    },
    get: vi.fn(async () => null),
    script: vi.fn(script) as HashStore["script"],
    set: vi.fn(async () => undefined),
  };
}

function createValueStore(initialValues: Record<string, unknown> = {}): ValueStore {
  const values = new Map(Object.entries(initialValues).map(([key, value]) => [key, typeof value === "string" ? value : JSON.stringify(value)]));
  const script: ValueStore["script"] = async <TResult = unknown>(scriptText: string, options?: DbScriptOptions<string>) => {
    const key = options?.keys?.[0] ?? "";

    if (scriptText.includes("GET")) {
      return (values.get(key) ?? null) as TResult;
    }

    if (scriptText.includes("SET")) {
      values.set(key, String(options?.args?.[0] ?? ""));
      return 1 as TResult;
    }

    return null as TResult;
  };

  return {
    del: vi.fn(async (key) => {
      values.delete(key);
    }),
    dumpValue(key) {
      return values.get(key) ?? null;
    },
    get: vi.fn(async () => null),
    script: vi.fn(script) as ValueStore["script"],
    set: vi.fn(async () => undefined),
  };
}

function createSourceStore(
  sources: Array<{
    apiUrl: string;
    key: string;
    name: string;
    no: number;
  }> = [
    {
      apiUrl: "https://alpha.test/api.php/provide/vod",
      key: "alpha",
      name: "Alpha Source",
      no: 1,
    },
  ],
): VideoSourceStore {
  const script: VideoSourceStore["script"] = async <TResult = unknown>() => Object.fromEntries(
    sources.map((source) => [source.key, JSON.stringify({
      adult: false,
      apiUrl: source.apiUrl,
      key: source.key,
      name: source.name,
      no: source.no,
      status: "enabled",
      type: "normal",
      updatedAt: null,
      validity: "valid",
      weight: 10,
    })]),
  ) as TResult;

  return {
    del: vi.fn(async () => undefined),
    get: vi.fn(async () => null),
    script: vi.fn(script) as VideoSourceStore["script"],
    set: vi.fn(async () => undefined),
  };
}

function createSiteConfigStore(showAdultContent = false): SiteConfigStore {
  const script: SiteConfigStore["script"] = async <TResult = unknown>() => ({
    enableKeywordFilter: "true",
    enableStreamingSearch: "true",
    showAdultContent: String(showAdultContent),
  } as TResult);

  return {
    del: vi.fn(async () => undefined),
    get: vi.fn(async () => null),
    script: vi.fn(script) as SiteConfigStore["script"],
    set: vi.fn(async () => undefined),
  };
}

function createDetail(overrides: Partial<VideoSourceResource> = {}): VideoSourceResource {
  return {
    description: "detail",
    episodeTitles: ["第1集", "第2集"],
    episodes: ["https://media.test/1.m3u8", "https://media.test/2.m3u8"],
    id: "80474",
    posterUrl: "https://image.test/poster.jpg",
    remarks: "更新至2集",
    sourceKey: "alpha",
    sourceName: "Alpha Source",
    title: "深空彼岸",
    typeName: "动漫",
    year: "2026",
    ...overrides,
  };
}

async function waitForMockCallCount(mock: ReturnType<typeof vi.fn>, count: number) {
  for (let attempts = 0; attempts < 20; attempts += 1) {
    if (mock.mock.calls.length >= count) {
      return;
    }

    await Promise.resolve();
  }
}

describe("playback source service", () => {
  it("uses cached playback sources by index before loading live data", async () => {
    const siteConfigStore = createSiteConfigStore(false);
    const videoSourceStore = createSourceStore();
    const cacheStore = createHashStore({
      [createPlaybackSourcesCacheKey("2026:anime:深空彼岸")]: {
        alpha: JSON.stringify({
          id: "80474",
          key: "alpha",
          name: "Alpha Source",
          order: 0,
          ping: 123,
          probe_url: "https://alpha.test/api.php/provide/vod",
          quality: "1080P",
          source_name: "Alpha Source",
          total_episodes: 2,
        }),
      },
    });
    const onStart = vi.fn();
    const onResult = vi.fn();
    const searcher = vi.fn();
    const detailFetcher = vi.fn();

    const summary = await getPlaybackSources(
      { index: "2026:anime:深空彼岸", keyword: "深空彼岸" },
      {
        cacheStore,
        detailFetcher,
        onResult,
        onStart,
        searcher,
        siteConfigStore,
        videoSourceStore,
      },
    );

    expect(cacheStore.script).toHaveBeenCalledWith(expect.stringContaining("GET"), {
      keys: [createPlaybackSourcesCacheKey("2026:anime:深空彼岸")],
      readOnly: true,
    });
    expect(siteConfigStore.script).not.toHaveBeenCalled();
    expect(videoSourceStore.script).not.toHaveBeenCalled();
    expect(searcher).not.toHaveBeenCalled();
    expect(detailFetcher).not.toHaveBeenCalled();
    expect(onStart).toHaveBeenCalledWith({ total: 1 });
    expect(onResult).toHaveBeenCalledWith({
      id: "80474",
      key: "alpha",
      name: "Alpha Source",
      probe_url: "https://alpha.test/api.php/provide/vod",
      quality: "1080P",
      source_name: "Alpha Source",
      total_episodes: 2,
    });
    expect(summary).toEqual({ completed: 1, total: 1 });
  });

  it("uses cached detail first and skips live source lookup", async () => {
    const indexStore = createHashStore({
      "2026:anime:深空彼岸": {
        alpha: JSON.stringify({ id: "80474", name: "Alpha Source", ping: 87, quality: "1080P" }),
      },
    });
    const cacheStore = createValueStore({
      "cache:video:alpha:80474": JSON.stringify({
        total_episodes: 2,
        id: "80474",
        idx: "",
        key: "alpha",
        cover: "https://image.test/poster.jpg",
        source: "Alpha Source",
        title: "深空彼岸",
        year: "2026",
        remarks: "更新至2集",
        tag: "动漫",
        episodes: ["https://media.test/1.m3u8", "https://media.test/2.m3u8"],
        description: "detail",
      }),
    });
    const searcher = vi.fn();
    const detailFetcher = vi.fn();
    const onResult = vi.fn();

    const summary = await getPlaybackSources(
      { index: "2026:anime:深空彼岸", keyword: "深空彼岸" },
      {
        cacheStore,
        detailFetcher,
        indexCacheStore: indexStore,
        onResult,
        searcher,
        siteConfigStore: createSiteConfigStore(false),
        videoSourceStore: createSourceStore(),
      },
    );

    expect(searcher).not.toHaveBeenCalled();
    expect(detailFetcher).not.toHaveBeenCalled();
    expect(onResult).toHaveBeenCalledWith({
      id: "80474",
      key: "alpha",
      name: "Alpha Source",
      probe_url: "https://alpha.test/api.php/provide/vod",
      quality: "1080P",
      source_name: "Alpha Source",
      total_episodes: 2,
    });
    expect(summary).toEqual({ completed: 1, total: 1 });
  });

  it("uses cached source search entries with episode counts before loading live details", async () => {
    const indexStore = createHashStore({
      "2026:anime:深空彼岸": {
        alpha: JSON.stringify({
          id: "80474",
          name: "Alpha Source",
          ping: 88,
          quality: "1080P",
          total_episodes: 2,
        }),
      },
    });
    const cacheStore = createValueStore();
    const searcher = vi.fn();
    const detailFetcher = vi.fn();
    const onResult = vi.fn();

    const summary = await getPlaybackSources(
      { index: "2026:anime:深空彼岸", keyword: "深空彼岸" },
      {
        cacheStore,
        detailFetcher,
        indexCacheStore: indexStore,
        onResult,
        searcher,
        siteConfigStore: createSiteConfigStore(false),
        videoSourceStore: createSourceStore(),
      },
    );

    expect(searcher).not.toHaveBeenCalled();
    expect(detailFetcher).not.toHaveBeenCalled();
    expect(onResult).toHaveBeenCalledWith({
      id: "80474",
      key: "alpha",
      name: "Alpha Source",
      probe_url: "https://alpha.test/api.php/provide/vod",
      quality: "1080P",
      source_name: "Alpha Source",
      total_episodes: 2,
    });
    expect(summary).toEqual({ completed: 1, total: 1 });
  });

  it("removes a source from both caches when third-party lookup misses", async () => {
    const indexStore = createHashStore({
      "2026:anime:深空彼岸": {
        alpha: JSON.stringify({ id: "80474", name: "Alpha Source", ping: 91, quality: "1080P" }),
      },
    });
    const cacheStore = createValueStore();
    const detailFetcher = vi.fn(async () => {
      throw new Error("Video source detail response is empty.");
    });

    const summary = await getPlaybackSources(
      { index: "2026:anime:深空彼岸", keyword: "深空彼岸" },
      {
        cacheStore,
        detailFetcher,
        indexCacheStore: indexStore,
        siteConfigStore: createSiteConfigStore(false),
        videoSourceStore: createSourceStore(),
      },
    );

    expect(summary).toEqual({ completed: 0, total: 1 });
    expect(indexStore.dumpHash("2026:anime:深空彼岸")).toEqual({});
    expect(cacheStore.del).toHaveBeenCalledWith("cache:video:alpha:80474");
  });

  it("does not expose server-side ping when cached source entries still need live detail lookup", async () => {
    const indexStore = createHashStore({
      "2026:anime:深空彼岸": {
        alpha: JSON.stringify({ id: "80474", name: "Alpha Source", ping: 12, quality: "1080P" }),
      },
    });
    const cacheStore = createValueStore();
    const detailFetcher = vi.fn(async () => createDetail());
    const onResult = vi.fn();

    const summary = await getPlaybackSources(
      { index: "2026:anime:深空彼岸", keyword: "深空彼岸" },
      {
        cacheStore,
        detailFetcher,
        indexCacheStore: indexStore,
        onResult,
        siteConfigStore: createSiteConfigStore(false),
        videoSourceStore: createSourceStore(),
      },
    );

    expect(detailFetcher).toHaveBeenCalledOnce();
    expect(onResult.mock.calls[0]?.[0]).not.toHaveProperty("ping");
    expect(onResult.mock.calls[0]?.[0]).toHaveProperty("probe_url", "https://alpha.test/api.php/provide/vod");
    expect(summary).toEqual({ completed: 1, total: 1 });
  });

  it("falls back to live source search when the index cache is missing", async () => {
    const indexStore = createHashStore();
    const cacheStore = createValueStore();
    const searcher = vi.fn(async () => [
      createDetail({
        id: "wrong-80474",
        title: "错误标题",
      }),
      createDetail(),
    ]);
    const detailFetcher = vi.fn(async (_source, id: string) => createDetail({ id }));
    const onResult = vi.fn();

    const summary = await getPlaybackSources(
      { index: "2026:anime:深空彼岸", keyword: "深空彼岸" },
      {
        cacheStore,
        detailFetcher,
        indexCacheStore: indexStore,
        onResult,
        searcher,
        siteConfigStore: createSiteConfigStore(false),
        videoSourceStore: createSourceStore(),
      },
    );

    expect(searcher).toHaveBeenCalledOnce();
    expect(searcher).toHaveBeenCalledWith(
      expect.objectContaining({ key: "alpha" }),
      "深空彼岸",
      {},
    );
    expect(detailFetcher).toHaveBeenCalledWith(
      expect.objectContaining({ key: "alpha" }),
      "80474",
      {},
    );
    expect(onResult.mock.calls[0]?.[0]).not.toHaveProperty("ping");
    expect(onResult.mock.calls[0]?.[0]).toHaveProperty("probe_url", "https://alpha.test/api.php/provide/vod");
    expect(cacheStore.dumpValue("cache:video:alpha:80474")).toContain('"id":"80474"');
    expect(indexStore.dumpHash("2026:anime:深空彼岸").alpha).not.toContain('"ping"');
    expect(indexStore.dumpHash("2026:anime:深空彼岸").alpha).not.toContain('"probe_url"');
    expect(summary).toEqual({ completed: 1, total: 1 });
  });

  it("loads live playback sources three at a time", async () => {
    const indexStore = createHashStore();
    const cacheStore = createValueStore();
    const sources = [
      { apiUrl: "https://alpha.test/api.php/provide/vod", key: "alpha", name: "Alpha Source", no: 1 },
      { apiUrl: "https://beta.test/api.php/provide/vod", key: "beta", name: "Beta Source", no: 2 },
      { apiUrl: "https://gamma.test/api.php/provide/vod", key: "gamma", name: "Gamma Source", no: 3 },
      { apiUrl: "https://delta.test/api.php/provide/vod", key: "delta", name: "Delta Source", no: 4 },
    ];
    const resolvers: Array<() => void> = [];
    let activeLookups = 0;
    let maxActiveLookups = 0;
    const searcher = vi.fn(async (source: { key: string; name: string }) => {
      activeLookups += 1;
      maxActiveLookups = Math.max(maxActiveLookups, activeLookups);

      await new Promise<void>((resolve) => {
        resolvers.push(() => {
          activeLookups -= 1;
          resolve();
        });
      });

      return [createDetail({
        id: `${source.key}-80474`,
        sourceKey: source.key,
        sourceName: source.name,
      })];
    });
    const detailFetcher = vi.fn(async (source: { key: string; name: string }, id: string) => createDetail({
      id,
      sourceKey: source.key,
      sourceName: source.name,
    }));

    const summaryPromise = getPlaybackSources(
      { index: "2026:anime:深空彼岸", keyword: "深空彼岸" },
      {
        cacheStore,
        detailFetcher,
        indexCacheStore: indexStore,
        searcher,
        siteConfigStore: createSiteConfigStore(false),
        videoSourceStore: createSourceStore(sources),
      },
    );

    await waitForMockCallCount(searcher, 3);

    expect(searcher).toHaveBeenCalledTimes(3);
    expect(maxActiveLookups).toBe(3);

    resolvers.shift()?.();
    await waitForMockCallCount(searcher, 4);

    expect(searcher).toHaveBeenCalledTimes(4);
    expect(maxActiveLookups).toBe(3);

    for (const resolve of resolvers.splice(0)) {
      resolve();
    }

    await expect(summaryPromise).resolves.toEqual({ completed: 4, total: 4 });
  });
});
