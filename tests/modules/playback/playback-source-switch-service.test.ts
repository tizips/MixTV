import { describe, expect, it, vi } from "vitest";
import type { VideoSourceResource } from "@/integrations/video-sources";
import type { VideoSourceStore } from "@/modules/admin/server/video-source-service";
import {
  switchPlaybackSource,
} from "@/modules/playback/server/playback-source-switch-service";
import type { DbPort, DbScriptOptions } from "@/shared/db/db-port";

type ProgressStore = DbPort<unknown, string> & {
  dumpHash: (key: string) => Record<string, string>;
};

function createProgressStore(initialValues: Record<string, Record<string, string>> = {}): ProgressStore {
  const values = new Map(Object.entries(initialValues).map(([key, record]) => [key, { ...record }]));
  const script: ProgressStore["script"] = async <TResult = unknown>(scriptText: string, options: DbScriptOptions<string> = {}) => {
    const key = options.keys?.[0] ?? "";
    const field = String(options.args?.[0] ?? "");
    const value = String(options.args?.[1] ?? "");
    const hash = values.get(key) ?? {};

    if (scriptText.includes("HGET")) {
      return (hash[field] ?? null) as TResult;
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

    return null as TResult;
  };

  return {
    del: vi.fn(async () => undefined),
    dumpHash(key) {
      return { ...(values.get(key) ?? {}) };
    },
    get: vi.fn(async () => null),
    script: vi.fn(script) as ProgressStore["script"],
    set: vi.fn(async () => undefined),
  };
}

function createVideoSourceStore(): VideoSourceStore {
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

function createDetail(overrides: Partial<VideoSourceResource> = {}): VideoSourceResource {
  return {
    description: "detail",
    episodeTitles: ["第1集", "第2集", "第3集"],
    episodes: [
      "https://media.test/1.m3u8",
      "https://media.test/2.m3u8",
      "https://media.test/3.m3u8",
    ],
    id: "80474",
    posterUrl: "https://image.test/poster.jpg",
    remarks: "更新至3集",
    sourceKey: "alpha",
    sourceName: "Alpha Source",
    title: "深空彼岸",
    typeName: "动漫",
    year: "2026",
    ...overrides,
  };
}

describe("playback source switch service", () => {
  it("switches the user's progress to the new source and clamps the active episode", async () => {
    const progressStore = createProgressStore({
      "user-1:pr": {
        "beta:80473": JSON.stringify({
          cover: "https://image.test/old.jpg",
          douban_id: 0,
          original_episodes: 12,
          play_time: 125,
          play_episodes: 2,
          remarks: "更新至12集",
          save_time: 1768535315661,
          search_title: "",
          source_name: "Beta Source",
          title: "深空彼岸",
          total_time: 2708,
          year: "2026",
        }),
      },
    });
    const cacheStore = {
      del: vi.fn(async () => undefined),
      get: vi.fn(async () => null),
      script: vi.fn(async () => null),
      set: vi.fn(async () => undefined),
    } as unknown as DbPort<unknown, string>;
    const detailFetcher = vi.fn(async () => createDetail());

    const result = await switchPlaybackSource(
      {
        current: { id: "80473", source: "beta" },
        play_episodes: 5,
        play_time: 125,
        target: { id: "80474", source: "alpha" },
        total_time: 2708,
      },
      {
        cacheStore,
        detailFetcher,
        progressStore,
        userId: "user-1",
        videoSourceStore: createVideoSourceStore(),
      },
    );

    expect(detailFetcher).toHaveBeenCalledWith(
      expect.objectContaining({ key: "alpha", name: "Alpha Source" }),
      "80474",
      {},
    );
    expect(detailFetcher).toHaveBeenCalledTimes(1);
    expect(result.progress).toMatchObject({
      id: "80474",
      play_episodes: 3,
      play_time: 125,
      source: "alpha",
      total_time: 2708,
    });
    expect(result.sources).toHaveLength(3);
    expect(progressStore.dumpHash("user-1:pr")["alpha:80474"]).toBeDefined();
    expect(progressStore.dumpHash("user-1:pr")["beta:80473"]).toBeUndefined();
  });
});
