import { describe, expect, it, vi } from "vitest";
import type { VideoSourceResource } from "@/integrations/video-sources";
import type { VideoSourceStore } from "@/modules/admin";
import { getPlaybackPageData } from "@/modules/playback/server/playback-service";
import type { DbPort, DbScriptOptions } from "@/shared/db/db-port";

function createStore(record: Record<string, string>): VideoSourceStore {
  const script: VideoSourceStore["script"] = async <TResult = unknown>() => record as TResult;

  return {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    script: vi.fn(script) as VideoSourceStore["script"],
  };
}

function createSource(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    adult: false,
    apiUrl: "https://source.test/api.php/provide/vod",
    key: "dyttzyapi.com",
    name: "电影天堂资源",
    no: 1,
    status: "enabled",
    type: "normal",
    validity: "valid",
    weight: 50,
    updatedAt: "2026-05-15T00:00:00.000Z",
    ...overrides,
  });
}

function createCacheStore(initialValues: Record<string, unknown> = {}): DbPort<unknown, string> {
  const values = new Map(Object.entries(initialValues).map(([key, value]) => [key, JSON.stringify(value)]));
  const script: DbPort<unknown, string>["script"] = async <TResult = unknown>(
    scriptText: string,
    options: DbScriptOptions<string> = {},
  ) => {
    const key = options.keys?.[0] ?? "";

    if (scriptText.includes("HGETALL")) {
      return Object.entries(Object.fromEntries(values)).flat() as TResult;
    }

    if (scriptText.includes("GET")) {
      return (values.get(key) ?? null) as TResult;
    }

    values.set(key, String(options.args?.[0] ?? ""));
    return 1 as TResult;
  };

  return {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    script: vi.fn(script) as DbPort<unknown, string>["script"],
  };
}

type ScriptProgressStore = DbPort<unknown, string> & {
  dumpHash: (key: string) => Record<string, string>;
};

type ScriptFavoriteStore = DbPort<unknown, string> & {
  dumpHash: (key: string) => Record<string, string>;
};

function createProgressStore(initialValues: Record<string, unknown> = {}): ScriptProgressStore {
  const values = new Map(
    Object.entries(initialValues).map(([field, value]) => [field, typeof value === "string" ? value : JSON.stringify(value)]),
  );
  const script: ScriptProgressStore["script"] = async <TResult = unknown>(scriptText: string, options?: DbScriptOptions<string>) => {
    const field = String(options?.args?.[0] ?? "");

    if (scriptText.includes("HGETALL")) {
      return Object.entries(Object.fromEntries(values)).flat() as TResult;
    }

    if (scriptText.includes("HGET")) {
      return (values.get(field) ?? null) as TResult;
    }

    if (scriptText.includes("HSET")) {
      values.set(field, String(options?.args?.[1] ?? ""));
      return String(options?.args?.[1] ?? "") as TResult;
    }

    if (scriptText.includes("HDEL")) {
      values.delete(field);
      return 1 as TResult;
    }

    return null as TResult;
  };

  return {
    del: vi.fn(),
    dumpHash(key) {
      return key === "user-1:pr" ? Object.fromEntries(values) : {};
    },
    get: vi.fn(),
    set: vi.fn(),
    script: vi.fn(script) as ScriptProgressStore["script"],
  };
}

function createFavoriteStore(initialValues: Record<string, unknown> = {}): ScriptFavoriteStore {
  const values = new Map(
    Object.entries(initialValues).map(([field, value]) => [field, typeof value === "string" ? value : JSON.stringify(value)]),
  );
  const script: ScriptFavoriteStore["script"] = async <TResult = unknown>(scriptText: string, options?: DbScriptOptions<string>) => {
    const field = String(options?.args?.[0] ?? "");

    if (scriptText.includes("HGET")) {
      return (values.get(field) ?? null) as TResult;
    }

    return null as TResult;
  };

  return {
    del: vi.fn(),
    dumpHash(key) {
      return key === "user-1:fav" ? Object.fromEntries(values) : {};
    },
    get: vi.fn(),
    set: vi.fn(),
    script: vi.fn(script) as ScriptFavoriteStore["script"],
  };
}

function createResource(overrides: Partial<VideoSourceResource> = {}): VideoSourceResource {
  return {
    className: "国产剧",
    description: "播放详情简介",
    episodeTitles: ["第1集", "第2集"],
    episodes: ["https://media.test/1.m3u8", "https://media.test/2.m3u8"],
    id: "80474",
    posterUrl: "https://image.test/poster.jpg",
    remarks: "更新至2集",
    sourceKey: "dyttzyapi.com",
    sourceName: "电影天堂资源",
    title: "资源站标题",
    typeName: "剧集",
    year: "2026",
    ...overrides,
  };
}

describe("getPlaybackPageData", () => {
  it("returns a placeholder error when source is missing", async () => {
    const result = await getPlaybackPageData({ id: "80474" }, { videoSourceStore: createStore({}) });

    expect(result).toEqual({
      error: "缺少 source 或 id 参数，无法加载播放信息。",
      status: "error",
    });
  });

  it("returns a placeholder error when id is missing", async () => {
    const result = await getPlaybackPageData({ source: "dyttzyapi.com" }, { videoSourceStore: createStore({}) });

    expect(result).toEqual({
      error: "缺少 source 或 id 参数，无法加载播放信息。",
      status: "error",
    });
  });

  it("resolves third-party detail into playback page data", async () => {
    const detailFetcher = vi.fn(async () => createResource());
    const result = await getPlaybackPageData(
      { id: "80474", source: "dyttzyapi.com" },
      {
        cacheStore: createCacheStore(),
        detailFetcher,
        videoSourceStore: createStore({ "dyttzyapi.com": createSource() }),
      },
    );

    expect(detailFetcher).toHaveBeenCalledWith(
      {
        apiUrl: "https://source.test/api.php/provide/vod",
        key: "dyttzyapi.com",
        name: "电影天堂资源",
      },
      "80474",
      {},
    );
    expect(result.status).toBe("ready");
    expect(result.status === "ready" ? result.data : null).toMatchObject({
      play_episodes: 1,
      description: "播放详情简介",
      episodes: [
        { duration: "未知", number: 1, title: "第1集" },
        { duration: "未知", number: 2, title: "第2集" },
      ],
      cover_default: expect.stringContaining("/assets/placeholders/poster/"),
      cover: "https://image.test/poster.jpg",
      source_name: "电影天堂资源",
      progress_id: "80474",
      progress_source: "dyttzyapi.com",
      sources: [
        {
          id: "episode-1",
          latency: "在线播放",
          name: "第1集",
          quality: "HLS",
          status: "流畅",
          url: "https://media.test/1.m3u8",
        },
        {
          id: "episode-2",
          latency: "在线播放",
          name: "第2集",
          quality: "HLS",
          status: "流畅",
          url: "https://media.test/2.m3u8",
        },
      ],
      title: "资源站标题",
      year: "2026",
    });
  });

  it("caches third-party detail for one hour by source key and resource id", async () => {
    const detailFetcher = vi.fn(async () => createResource({ doubanId: 34925294 }));
    const cacheStore = createCacheStore();

    await getPlaybackPageData(
      { id: "80474", source: "dyttzyapi.com" },
      {
        cacheStore,
        detailFetcher,
        videoSourceStore: createStore({ "dyttzyapi.com": createSource() }),
      },
    );

    expect(cacheStore.script).toHaveBeenCalledWith(expect.stringContaining("EX"), {
      args: [
        JSON.stringify({
          total_episodes: 2,
          id: "80474",
          idx: "douban:34925294",
          key: "dyttzyapi.com",
          cover: "https://image.test/poster.jpg",
          source: "电影天堂资源",
          title: "资源站标题",
          year: "2026",
          remarks: "更新至2集",
          tag: "剧集",
          episodes: ["https://media.test/1.m3u8", "https://media.test/2.m3u8"],
          description: "播放详情简介",
        }),
        3600,
      ],
      keys: ["cache:video:dyttzyapi.com:80474"],
    });
  });

  it("uses the third-party detail cache payload shape when reading cached resources", async () => {
    const detailFetcher = vi.fn(async () => createResource({ title: "Should not fetch" }));
    const result = await getPlaybackPageData(
      { id: "80474", source: "dyttzyapi.com" },
      {
        cacheStore: createCacheStore({
          "cache:video:dyttzyapi.com:80474": {
            total_episodes: 2,
            id: "80474",
            idx: "douban:34925294",
            key: "dyttzyapi.com",
            cover: "https://image.test/cached.jpg",
            source: "缓存资源站",
            title: "Cached Title",
            year: "2026",
            remarks: "更新至2集",
            tag: "国产剧",
            episodes: ["https://media.test/1.m3u8", "https://media.test/2.m3u8"],
            description: "缓存简介",
          },
        }),
        detailFetcher,
        videoSourceStore: createStore({ "dyttzyapi.com": createSource() }),
      },
    );

    expect(detailFetcher).not.toHaveBeenCalled();
    expect(result.status === "ready" ? result.data : null).toMatchObject({
      description: "缓存简介",
      cover_default: expect.stringContaining("/assets/placeholders/poster/"),
      cover: "https://image.test/cached.jpg",
      source_name: "缓存资源站",
      title: "Cached Title",
    });
  });

  it("ignores legacy cached third-party detail payloads", async () => {
    const detailFetcher = vi.fn(async () => createResource({ title: "Should not fetch" }));
    const result = await getPlaybackPageData(
      { id: "80474", source: "dyttzyapi.com" },
      {
        cacheStore: createCacheStore({ "cache:video:dyttzyapi.com:80474": createResource({ title: "Cached Title" }) }),
        detailFetcher,
        videoSourceStore: createStore({ "dyttzyapi.com": createSource() }),
      },
    );

    expect(detailFetcher).toHaveBeenCalledOnce();
    expect(result.status === "ready" ? result.data.title : null).toBe("Should not fetch");
  });

  it("creates zero playback progress when a signed-in user opens a resource without existing progress", async () => {
    const detailFetcher = vi.fn(async () => createResource());
    const progressStore = createProgressStore();

    const result = await getPlaybackPageData(
      { id: "80474", source: "dyttzyapi.com" },
      {
        cacheStore: createCacheStore(),
        detailFetcher,
        now: () => 1768535315661,
        progressStore,
        userId: "user-1",
        videoSourceStore: createStore({ "dyttzyapi.com": createSource() }),
      },
    );

    expect(result.status).toBe("ready");
    expect(JSON.parse(progressStore.dumpHash("user-1:pr")["dyttzyapi.com:80474"] ?? "{}")).toMatchObject({
      play_episodes: 1,
      play_time: 0,
      total_time: 0,
    });
  });

  it("resumes from existing playback progress without overwriting it", async () => {
    const progressStore = createProgressStore({
      "dyttzyapi.com:80474": {
        cover: "https://image.test/poster.jpg",
        douban_id: 0,
        original_episodes: 2,
        play_time: 125,
        play_episodes: 2,
        remarks: "更新至2集",
        save_time: 1768535315661,
        search_title: "",
        source_name: "电影天堂资源",
        title: "资源站标题",
        total_episodes: 2,
        total_time: 1247,
        year: "2026",
      },
    });

    const result = await getPlaybackPageData(
      { id: "80474", source: "dyttzyapi.com" },
      {
        cacheStore: createCacheStore(),
        detailFetcher: vi.fn(async () => createResource()),
        now: () => 1768535319999,
        progressStore,
        userId: "user-1",
        videoSourceStore: createStore({ "dyttzyapi.com": createSource() }),
      },
    );

    expect(result.status === "ready" ? result.data.play_episodes : null).toBe(2);
    expect(result.status === "ready" ? result.data.play_time : null).toBe(125);
    expect(JSON.parse(progressStore.dumpHash("user-1:pr")["dyttzyapi.com:80474"] ?? "{}").save_time).toBe(1768535315661);
  });

  it("keeps the requested playback source and migrates matching history to it", async () => {
    const progressStore = createProgressStore({
      "alpha:80474": {
        cover: "https://image.test/alpha.jpg",
        douban_id: 0,
        index: "2026:tv:资源站标题",
        original_episodes: 2,
        play_time: 125,
        play_episodes: 2,
        remarks: "更新至2集",
        save_time: 1768535315661,
        search_title: "",
        source_name: "Alpha Source",
        title: "资源站标题",
        total_time: 1247,
        year: "2026",
      },
    });
    const detailFetcher = vi.fn(async (source) => {
      if (source.key === "alpha") {
        return createResource({
          className: "剧集",
          episodeTitles: ["第1集", "第2集"],
          episodes: ["https://alpha.test/1.m3u8", "https://alpha.test/2.m3u8"],
          id: "80474",
          posterUrl: "https://image.test/alpha.jpg",
          sourceKey: "alpha",
          sourceName: "Alpha Source",
          title: "资源站标题",
          typeName: "剧集",
          year: "2026",
        });
      }

      return createResource({
        className: "剧集",
        episodeTitles: ["第1集", "第2集"],
        episodes: ["https://beta.test/1.m3u8", "https://beta.test/2.m3u8"],
        id: "90001",
        posterUrl: "https://image.test/beta.jpg",
        sourceKey: "beta",
        sourceName: "Beta Source",
        title: "资源站标题",
        typeName: "剧集",
        year: "2026",
      });
    });

    const result = await getPlaybackPageData(
      { id: "90001", source: "beta" },
      {
        cacheStore: createCacheStore(),
        detailFetcher,
        progressStore,
        userId: "user-1",
        videoSourceStore: createStore({
          alpha: createSource({ key: "alpha", name: "Alpha Source" }),
          beta: createSource({ key: "beta", name: "Beta Source" }),
        }),
      },
    );

    expect(result.status).toBe("ready");
    if (result.status !== "ready") {
      throw new Error("expected ready playback data");
    }

    expect(result.data.progress_source).toBe("beta");
    expect(result.data.progress_id).toBe("90001");
    expect(result.data.play_episodes).toBe(2);
    expect(result.data.play_time).toBe(125);
    expect(result.data.source_name).toBe("Beta Source");
    expect(detailFetcher).toHaveBeenCalledWith(
      expect.objectContaining({ key: "beta", name: "Beta Source" }),
      "90001",
      {},
    );
    expect(detailFetcher).toHaveBeenCalledTimes(1);
    expect(JSON.parse(progressStore.dumpHash("user-1:pr")["beta:90001"] ?? "{}")).toMatchObject({
      play_episodes: 2,
      play_time: 125,
      source_name: "Beta Source",
    });
    expect(progressStore.dumpHash("user-1:pr")["alpha:80474"]).toBeUndefined();
  });

  it("returns the direct favorite state for the requested playback resource", async () => {
    const favoriteStore = createFavoriteStore({
      "dyttzyapi.com:80474": {
        cover: "https://image.test/poster.jpg",
        douban_id: 0,
        original_episodes: 2,
        remarks: "更新至2集",
        save_time: 1768535315661,
        search_title: "",
        source_name: "电影天堂资源",
        title: "资源站标题",
        total_episodes: 2,
        year: "2026",
      },
    });

    const result = await getPlaybackPageData(
      { id: "80474", source: "dyttzyapi.com" },
      {
        cacheStore: createCacheStore(),
        detailFetcher: vi.fn(async () => createResource()),
        favoriteStore,
        progressStore: createProgressStore(),
        userId: "user-1",
        videoSourceStore: createStore({ "dyttzyapi.com": createSource() }),
      },
    );

    expect(result.status === "ready" ? result.data.is_favorite : null).toBe(true);
    expect(favoriteStore.script).toHaveBeenCalledWith(expect.stringContaining("HGET"), {
      args: ["dyttzyapi.com:80474"],
      keys: ["user-1:fav"],
      readOnly: true,
    });
  });
});
