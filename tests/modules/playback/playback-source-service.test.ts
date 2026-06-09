import { describe, expect, it, vi } from "vitest";
import type { VideoSourceResource } from "@/integrations/video-sources";
import type { SiteConfigStore } from "@/modules/admin/server/site-config-service";
import type { VideoSourceStore } from "@/modules/admin/server/video-source-service";
import {
  getPlaybackSources,
} from "@/modules/playback/server/playback-source-service";
import { createPlaybackSourcesCacheKey } from "@/modules/playback/server/playback-cache";
import {
  createEdgeOneKvHashStore,
  createEdgeOneKvStringStore,
  dumpEdgeOneKvHash,
  dumpEdgeOneKvString,
} from "../../helpers/fake-edgeone-kv";

function createHashStore(initialValues: Record<string, Record<string, unknown>> = {}) {
  return createEdgeOneKvHashStore(initialValues);
}

function createValueStore(initialValues: Record<string, unknown> = {}) {
  return createEdgeOneKvStringStore(initialValues);
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
): Promise<VideoSourceStore> {
  return createEdgeOneKvHashStore({
    sources: Object.fromEntries(
      sources.map((source) => [
        source.key,
        JSON.stringify({
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
        }),
      ]),
    ),
  }, { namespace: "admin" });
}

function createSiteConfigStore(showAdultContent = false): Promise<SiteConfigStore> {
  return createEdgeOneKvHashStore({
    site: {
      enableKeywordFilter: "true",
      enableStreamingSearch: "true",
      showAdultContent: String(showAdultContent),
    },
  }, { namespace: "admin" });
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
  it("uses cached playback sources by index before loading live data", async () => {
    const siteConfigStore = await createSiteConfigStore(false);
    const videoSourceStore = await createSourceStore();
    const cacheStore = await createHashStore({
      [createPlaybackSourcesCacheKey("2026:anime:深空彼岸")]: {
        alpha: JSON.stringify({
          id: "80474",
          key: "alpha",
          name: "Alpha Source",
          order: 0,
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

    const siteConfigGet = vi.spyOn(siteConfigStore, "get");
    const videoSourceGet = vi.spyOn(videoSourceStore, "get");

    const summary = await getPlaybackSources(
      { index: "2026:anime:深空彼岸" },
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

    expect(siteConfigGet).not.toHaveBeenCalled();
    expect(videoSourceGet).not.toHaveBeenCalled();
    expect(searcher).not.toHaveBeenCalled();
    expect(detailFetcher).not.toHaveBeenCalled();
    expect(onStart).toHaveBeenCalledWith({ total: 1 });
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

  it("uses cached detail first and skips live source lookup", async () => {
    const indexStore = await createHashStore({
      "2026:anime:深空彼岸": {
        alpha: JSON.stringify({ id: "80474", name: "Alpha Source", quality: "1080P" }),
      },
    });
    const cacheStore = await createValueStore({
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
        siteConfigStore: await createSiteConfigStore(false),
        videoSourceStore: await createSourceStore(),
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

  it("uses cached source search entries with episode counts before loading live details", async () => {
    const indexStore = await createHashStore({
      "2026:anime:深空彼岸": {
        alpha: JSON.stringify({
          id: "80474",
          name: "Alpha Source",
          quality: "1080P",
          total_episodes: 2,
        }),
      },
    });
    const cacheStore = await createValueStore();
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
        siteConfigStore: await createSiteConfigStore(false),
        videoSourceStore: await createSourceStore(),
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
    const indexStore = await createHashStore({
      "2026:anime:深空彼岸": {
        alpha: JSON.stringify({ id: "80474", name: "Alpha Source", quality: "1080P" }),
      },
    });
    const cacheStore = await createValueStore();
    const detailFetcher = vi.fn(async () => {
      throw new Error("Video source detail response is empty.");
    });

    const summary = await getPlaybackSources(
      { index: "2026:anime:深空彼岸" },
      {
        cacheStore,
        detailFetcher,
        indexCacheStore: indexStore,
        siteConfigStore: await createSiteConfigStore(false),
        videoSourceStore: await createSourceStore(),
      },
    );

    expect(summary).toEqual({ completed: 0, total: 1 });
    await expect(dumpEdgeOneKvHash(indexStore, "2026:anime:深空彼岸")).resolves.toEqual({});
    await expect(dumpEdgeOneKvString(cacheStore, "cache:video:alpha:80474")).resolves.toBeNull();
  });

  it("falls back to live source search when the index cache is missing", async () => {
    const indexStore = await createHashStore();
    const cacheStore = await createValueStore();
    const searcher = vi.fn(async () => [createDetail()]);
    const detailFetcher = vi.fn(async () => createDetail());

    const summary = await getPlaybackSources(
      { index: "2026:anime:深空彼岸" },
      {
        cacheStore,
        detailFetcher,
        indexCacheStore: indexStore,
        searcher,
        siteConfigStore: await createSiteConfigStore(false),
        videoSourceStore: await createSourceStore(),
      },
    );

    expect(searcher).toHaveBeenCalledOnce();
    expect(detailFetcher).toHaveBeenCalledOnce();
    await expect(dumpEdgeOneKvString(cacheStore, "cache:video:alpha:80474")).resolves.toContain('"id":"80474"');
    expect(summary).toEqual({ completed: 1, total: 1 });
  });

  it("looks up playback sources concurrently when cache entries are missing", async () => {
    const indexStore = await createHashStore();
    const cacheStore = await createValueStore();
    const sources = ["alpha", "beta", "gamma"].map((key, index) => ({
      apiUrl: `https://${key}.test/api.php/provide/vod`,
      key,
      name: `${key} Source`,
      no: index + 1,
    }));
    let activeSearches = 0;
    let maxActiveSearches = 0;
    const searcher = vi.fn(async (source) => {
      activeSearches += 1;
      maxActiveSearches = Math.max(maxActiveSearches, activeSearches);

      await new Promise((resolve) => setTimeout(resolve, 10));

      activeSearches -= 1;
      return [
        createDetail({
          id: `${source.key}-id`,
          sourceKey: source.key,
          sourceName: source.name,
        }),
      ];
    });
    const detailFetcher = vi.fn(async (source) =>
      createDetail({
        id: `${source.key}-id`,
        sourceKey: source.key,
        sourceName: source.name,
      }));

    const summary = await getPlaybackSources(
      { index: "2026:anime:深空彼岸" },
      {
        cacheStore,
        detailFetcher,
        indexCacheStore: indexStore,
        searcher,
        siteConfigStore: await createSiteConfigStore(false),
        videoSourceStore: await createSourceStore(sources),
      },
    );

    expect(searcher).toHaveBeenCalledTimes(3);
    expect(detailFetcher).toHaveBeenCalledTimes(3);
    expect(maxActiveSearches).toBeGreaterThan(1);
    expect(summary).toEqual({ completed: 3, total: 3 });
  });
});
