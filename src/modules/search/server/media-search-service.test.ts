import { describe, expect, it, vi } from "vitest";
import { searchMediaSources } from "./media-search-service";

function createSiteConfigStore() {
  return {
    script: vi.fn(async () => ({
      siteName: "MixTV",
      siteAnnouncement: "",
      doubanDataProxyMode: "direct",
      doubanDataProxyUrl: "",
      doubanImageProxyMode: "direct",
      doubanImageProxyUrl: "",
      doubanAuth: "",
      enableKeywordFilter: "true",
      enableStreamingSearch: "true",
      showAdultContent: "false",
    })),
  };
}

function createVideoSourceStore() {
  return {
    script: vi.fn(async () => ({
      alpha: JSON.stringify({
        adult: false,
        apiUrl: "https://source.test/api",
        key: "alpha",
        name: "Alpha",
        no: 1,
        status: "enabled",
        type: "normal",
        validity: "valid",
        weight: 50,
      }),
    })),
  };
}

describe("media search service", () => {
  it("aggregates results with a year:type:title index and writes cache entries", async () => {
    const siteConfigStore = createSiteConfigStore();
    const videoSourceStore = createVideoSourceStore();
    const cacheStore = { script: vi.fn(async () => undefined) };
    const searcher = vi.fn(async () => [
      {
        className: "电视剧",
        description: "desc",
        episodes: ["https://media.test/1.m3u8"],
        id: "movie-1",
        posterUrl: "https://image.test/poster.jpg",
        sourceKey: "alpha",
        sourceName: "电影天堂资源",
        title: "庆余年 第二季",
        typeName: "电视剧",
        year: "2024",
        quality: "1080p",
      },
    ]);

    const onResult = vi.fn();

    const summary = await searchMediaSources(
      { query: "庆余年" },
      {
        cacheStore: cacheStore as any,
        onResult,
        searcher: searcher as any,
        siteConfigStore: siteConfigStore as any,
        videoSourceStore: videoSourceStore as any,
      },
    );

    expect(summary).toEqual({ completed: 1, total: 1 });
    expect(searcher).toHaveBeenCalledTimes(1);
    expect(onResult).toHaveBeenCalledTimes(1);
    expect(onResult.mock.calls[0]?.[0].results[0]).toMatchObject({
      idx: "2024:tv:庆余年第二季",
      key: "alpha",
      source_name: "电影天堂资源",
    });
    expect(cacheStore.script).toHaveBeenCalledWith(
      expect.any(String),
      {
        args: [
          "alpha",
          JSON.stringify({
            id: "movie-1",
            quality: "1080p",
            name: "电影天堂资源",
          }),
          604800,
        ],
        keys: ["2024:tv:庆余年第二季"],
      },
    );
  });
});
