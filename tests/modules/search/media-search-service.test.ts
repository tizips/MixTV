import { describe, expect, it, vi } from "vitest";
import { searchMediaSources } from "@/modules/search/server/media-search-service";
import type { SiteConfigStore } from "@/modules/admin/server/site-config-service";
import type { VideoSourceStore } from "@/modules/admin/server/video-source-service";
import type { VideoSourceResource } from "@/integrations/video-sources";

function createSiteConfigStore(showAdultContent: boolean): SiteConfigStore {
  const script: SiteConfigStore["script"] = async <TResult = unknown>() => ({
    showAdultContent: String(showAdultContent),
  } as TResult);

  return {
    del: vi.fn(async () => undefined),
    get: vi.fn(async () => null),
    script: vi.fn(script) as SiteConfigStore["script"],
    set: vi.fn(async () => undefined),
  };
}

function createVideoSourceStore(): VideoSourceStore {
  const script: VideoSourceStore["script"] = async <TResult = unknown>() => ({
    enabled: JSON.stringify({
      adult: false,
      apiUrl: "https://enabled.test/api",
      key: "enabled",
      name: "Enabled",
      no: 1,
      status: "enabled",
      type: "normal",
      updatedAt: null,
      validity: "valid",
      weight: 10,
    }),
    adult: JSON.stringify({
      adult: true,
      apiUrl: "https://adult.test/api",
      key: "adult",
      name: "Adult",
      no: 2,
      status: "enabled",
      type: "normal",
      updatedAt: null,
      validity: "valid",
      weight: 10,
    }),
    disabled: JSON.stringify({
      adult: false,
      apiUrl: "https://disabled.test/api",
      key: "disabled",
      name: "Disabled",
      no: 3,
      status: "disabled",
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

function createResource(sourceKey: string, overrides: Partial<VideoSourceResource> = {}): VideoSourceResource {
  return {
    description: "",
    episodeTitles: ["1"],
    episodes: [`https://${sourceKey}.test/1.m3u8`],
    id: "1",
    posterUrl: "",
    quality: "1080P",
    sourceKey,
    sourceName: sourceKey,
    title: `Title ${sourceKey}`,
    year: "2026",
    ...overrides,
  };
}

describe("media search service", () => {
  it("searches only enabled non-adult sources when adult content is hidden", async () => {
    const searcher = vi.fn(async (source) => [createResource(source.key)]);
    const onStart = vi.fn();
    const onResult = vi.fn();

    const summary = await searchMediaSources(
      { query: "movie" },
      {
        onResult,
        onStart,
        searcher,
        siteConfigStore: createSiteConfigStore(false),
        videoSourceStore: createVideoSourceStore(),
      },
    );

    expect(onStart).toHaveBeenCalledWith({ total: 1 });
    expect(searcher).toHaveBeenCalledTimes(1);
    expect(searcher).toHaveBeenCalledWith(
      expect.objectContaining({ key: "enabled", name: "Enabled" }),
      "movie",
      expect.any(Object),
    );
    expect(onResult).toHaveBeenCalledWith(
      expect.objectContaining({
        results: expect.arrayContaining([
          expect.objectContaining({
            cover: "",
            id: "1",
            idx: expect.stringContaining("titleenabled"),
            key: "enabled",
            quality: "1080P",
            source_name: "enabled",
            source_total: 1,
            title: "Title enabled",
            total_episodes: 1,
            year: "2026",
          }),
        ]),
        source: expect.objectContaining({ adult: false, key: "enabled", status: "enabled" }),
      }),
    );
    expect(summary).toEqual({ completed: 1, total: 1 });
  });

  it("includes enabled adult sources when the site config allows adult content", async () => {
    const searcher = vi.fn(async (source) => [createResource(source.key)]);

    const summary = await searchMediaSources(
      { query: "movie" },
      {
        searcher,
        siteConfigStore: createSiteConfigStore(true),
        videoSourceStore: createVideoSourceStore(),
      },
    );

    expect(searcher).toHaveBeenCalledTimes(2);
    expect(searcher.mock.calls.map(([source]) => source.key)).toEqual(["enabled", "adult"]);
    expect(summary).toEqual({ completed: 2, total: 2 });
  });

  it("continues searching other sources when one source aborts", async () => {
    const onResult = vi.fn();
    const searcher = vi.fn(async (source) => {
      if (source.key === "enabled") {
        throw new Error("This operation was aborted");
      }

      return [createResource(source.key)];
    });

    const summary = await searchMediaSources(
      { query: "movie" },
      {
        onResult,
        searcher,
        siteConfigStore: createSiteConfigStore(true),
        videoSourceStore: createVideoSourceStore(),
      },
    );

    expect(searcher).toHaveBeenCalledTimes(2);
    expect(onResult).toHaveBeenCalledTimes(2);
    expect(onResult).toHaveBeenNthCalledWith(1, {
      results: [],
      source: expect.objectContaining({ key: "enabled" }),
    });
    expect(onResult).toHaveBeenNthCalledWith(2, {
      results: [
        expect.objectContaining({
          key: "adult",
          title: "Title adult",
        }),
      ],
      source: expect.objectContaining({ key: "adult" }),
    });
    expect(summary).toEqual({ completed: 2, total: 2 });
  });

  it("searches video sources concurrently to keep streaming responsive", async () => {
    let activeSearches = 0;
    let maxActiveSearches = 0;
    const searcher = vi.fn(async (source) => {
      activeSearches += 1;
      maxActiveSearches = Math.max(maxActiveSearches, activeSearches);

      await new Promise((resolve) => setTimeout(resolve, 10));

      activeSearches -= 1;
      return [createResource(source.key)];
    });

    const summary = await searchMediaSources(
      { query: "movie" },
      {
        searcher,
        siteConfigStore: createSiteConfigStore(true),
        videoSourceStore: createVideoSourceStore(),
      },
    );

    expect(searcher).toHaveBeenCalledTimes(2);
    expect(maxActiveSearches).toBeGreaterThan(1);
    expect(summary).toEqual({ completed: 2, total: 2 });
  });

  it("aggregates the same title and year across multiple sources", async () => {
    const onResult = vi.fn();
    const searcher = vi.fn(async (source) => [
      createResource(source.key, {
        episodes: [`https://${source.key}.test/movie.m3u8`],
        id: source.key === "enabled" ? "enabled-id" : "adult-id",
        posterUrl: source.key === "enabled" ? "https://image.test/a.jpg" : "https://image.test/b.jpg",
        sourceName: source.name,
        title: "Same Movie",
        typeName: "电影",
        year: "2026",
      }),
    ]);

    await searchMediaSources(
      { query: "movie" },
      {
        onResult,
        searcher,
        siteConfigStore: createSiteConfigStore(true),
        videoSourceStore: createVideoSourceStore(),
      },
    );

    expect(onResult).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        results: expect.arrayContaining([
          expect.objectContaining({
            id: "enabled-id",
            idx: expect.stringContaining("samemovie"),
            key: "enabled",
            source_name: "Enabled",
            source_total: 1,
            title: "Same Movie",
          }),
        ]),
      }),
    );
    expect(onResult).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        results: expect.arrayContaining([
          expect.objectContaining({
            id: "enabled-id",
            idx: expect.stringContaining("samemovie"),
            key: "enabled",
            source_name: "Enabled",
            source_total: 2,
            title: "Same Movie",
          }),
        ]),
      }),
    );
  });
});
