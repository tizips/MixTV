import { describe, expect, it, vi } from "vitest";
import type { VideoSourceResource } from "@/integrations/video-sources";
import type { SiteConfigStore } from "@/modules/admin/server/site-config-service";
import type { VideoSourceStore } from "@/modules/admin/server/video-source-service";
import {
  getPlaybackSources,
} from "@/modules/playback/server/playback-source-service";
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
      hash[field] = value;
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

function createValueStore(initialValues: Record<string, string> = {}): ValueStore {
  const values = new Map(Object.entries(initialValues));
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

function createSourceStore(): VideoSourceStore {
  const script: VideoSourceStore["script"] = async <TResult = unknown>() => ({
    alpha: JSON.stringify({
      adult: false,
      apiUrl: "https://alpha.test/api.php/provide/vod",
      key: "alpha",
      name: "Alpha Source",
      no: 1,
      status: "enabled",
      type: "normal",
      updatedAt: null,
      validity: "valid",
      weight: 10,
    }),
  } as TResult);

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

describe("playback source service", () => {
  it("uses cached detail first and skips live source lookup", async () => {
    const indexStore = createHashStore({
      "2026:anime:深空彼岸": {
        alpha: JSON.stringify({ id: "80474", name: "Alpha Source", quality: "1080P" }),
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
      { index: "2026:anime:深空彼岸" },
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
      quality: "1080P",
      source_name: "Alpha Source",
      total_episodes: 2,
    });
    expect(summary).toEqual({ completed: 1, total: 1 });
  });

  it("removes a source from both caches when third-party lookup misses", async () => {
    const indexStore = createHashStore({
      "2026:anime:深空彼岸": {
        alpha: JSON.stringify({ id: "80474", name: "Alpha Source", quality: "1080P" }),
      },
    });
    const cacheStore = createValueStore();
    const detailFetcher = vi.fn(async () => {
      throw new Error("Video source detail response is empty.");
    });

    const summary = await getPlaybackSources(
      { index: "2026:anime:深空彼岸" },
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

  it("falls back to live source search when the index cache is missing", async () => {
    const indexStore = createHashStore();
    const cacheStore = createValueStore();
    const searcher = vi.fn(async () => [createDetail()]);
    const detailFetcher = vi.fn(async () => createDetail());

    const summary = await getPlaybackSources(
      { index: "2026:anime:深空彼岸" },
      {
        cacheStore,
        detailFetcher,
        indexCacheStore: indexStore,
        searcher,
        siteConfigStore: createSiteConfigStore(false),
        videoSourceStore: createSourceStore(),
      },
    );

    expect(searcher).toHaveBeenCalledOnce();
    expect(detailFetcher).toHaveBeenCalledOnce();
    expect(JSON.parse(indexStore.dumpHash("2026:anime:深空彼岸").alpha ?? "{}")).toMatchObject({
      id: "80474",
      name: "Alpha Source",
      quality: "",
    });
    expect(cacheStore.dumpValue("cache:video:alpha:80474")).toContain('"id":"80474"');
    expect(summary).toEqual({ completed: 1, total: 1 });
  });
});
