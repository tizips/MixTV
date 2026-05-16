import { describe, expect, it, vi } from "vitest";
import type { VideoSourceResource } from "@/integrations/video-sources";
import type { VideoSourceStore } from "@/modules/admin/server/video-source-service";
import {
  getOrCreateInitialPlaybackProgress,
  savePlaybackProgress,
  PlaybackProgressValidationError,
} from "@/modules/playback/server/playback-progress-service";
import type { DbPort, DbScriptOptions } from "@/shared/db/db-port";

type ScriptPlaybackProgressStore = DbPort<unknown, string> & {
  dumpHash: (key: string) => Record<string, string>;
};

function createPlaybackProgressStore(): ScriptPlaybackProgressStore {
  const hashes = new Map<string, Record<string, string>>();

  return {
    del: vi.fn(async (key) => {
      hashes.delete(key);
    }),
    dumpHash(key) {
      return { ...(hashes.get(key) ?? {}) };
    },
    get: vi.fn(async () => null),
    async script<TResult = unknown>(script: string, options?: DbScriptOptions<string>) {
      const key = options?.keys?.[0] ?? "";
      const field = String(options?.args?.[0] ?? "");
      const value = String(options?.args?.[1] ?? "");
      const hash = hashes.get(key) ?? {};

      if (script.includes("HGET")) {
        return (hash[field] ?? null) as TResult;
      }

      if (script.includes("HSET")) {
        hash[field] = value;
        hashes.set(key, hash);

        return value as TResult;
      }

      return hash as TResult;
    },
    set: vi.fn(async () => undefined),
  };
}

function createVideoSourceStore(): VideoSourceStore {
  return {
    del: vi.fn(async () => undefined),
    get: vi.fn(async () => null),
    script: vi.fn(async <TResult = unknown>() => ({
      alpha: JSON.stringify({
        adult: false,
        apiUrl: "https://alpha.test/api",
        key: "alpha",
        name: "Alpha Source",
        no: 1,
        status: "enabled",
        type: "normal",
        updatedAt: null,
        validity: "valid",
        weight: 10,
      }),
    }) as TResult),
    set: vi.fn(async () => undefined),
  };
}

function createDetail(overrides: Partial<VideoSourceResource> = {}): VideoSourceResource {
  return {
    description: "detail",
    episodeTitles: ["1", "2", "3"],
    episodes: [
      "https://alpha.test/1.m3u8",
      "https://alpha.test/2.m3u8",
      "https://alpha.test/3.m3u8",
    ],
    id: "100",
    posterUrl: "https://image.test/poster.jpg",
    remarks: "更新至3集",
    sourceKey: "alpha",
    sourceName: "Alpha Source",
    title: "Alpha Movie",
    year: "2026",
    ...overrides,
  };
}

describe("playback progress service", () => {
  it("saves user-scoped playback progress from third-party detail data", async () => {
    const store = createPlaybackProgressStore();
    const detailFetcher = vi.fn(async () => createDetail());

    const progress = await savePlaybackProgress(
      { id: "100", index: 2, play_time: 1061, source: "alpha", total_time: 1247 },
      {
        detailFetcher,
        now: () => 1768535315661,
        store,
        userId: "user-1",
        videoSourceStore: createVideoSourceStore(),
      },
    );

    expect(detailFetcher).toHaveBeenCalledWith(
      expect.objectContaining({ apiUrl: "https://alpha.test/api", key: "alpha", name: "Alpha Source" }),
      "100",
      {},
    );
    expect(progress).toEqual({
      cover: "https://image.test/poster.jpg",
      douban_id: 0,
      id: "100",
      original_episodes: 3,
      play_time: 1061,
      play_episodes: 2,
      remarks: "更新至3集",
      save_time: 1768535315661,
      search_title: "",
      source: "alpha",
      source_name: "Alpha Source",
      title: "Alpha Movie",
      total_time: 1247,
      year: "2026",
    });
    expect(JSON.parse(store.dumpHash("user-1:pr")["alpha:100"] ?? "{}")).toEqual({
      cover: "https://image.test/poster.jpg",
      douban_id: 0,
      original_episodes: 3,
      play_time: 1061,
      play_episodes: 2,
      remarks: "更新至3集",
      save_time: 1768535315661,
      search_title: "",
      source_name: "Alpha Source",
      title: "Alpha Movie",
      total_time: 1247,
      year: "2026",
    });
  });

  it("creates zero progress when a record is missing", async () => {
    const store = createPlaybackProgressStore();

    const progress = await getOrCreateInitialPlaybackProgress(
      { detail: createDetail(), id: "100", source: "alpha" },
      { now: () => 1768535315661, store, userId: "user-1" },
    );

    expect(progress.play_episodes).toBe(1);
    expect(progress.play_time).toBe(0);
    expect(progress.total_time).toBe(0);
    expect(JSON.parse(store.dumpHash("user-1:pr")["alpha:100"] ?? "{}")).toMatchObject({
      play_episodes: 1,
      play_time: 0,
      total_time: 0,
    });
  });

  it("returns existing initial progress without overwriting it", async () => {
    const store = createPlaybackProgressStore();
    await getOrCreateInitialPlaybackProgress(
      { detail: createDetail(), id: "100", source: "alpha" },
      { now: () => 1768535315661, store, userId: "user-1" },
    );

    const progress = await getOrCreateInitialPlaybackProgress(
      { detail: createDetail(), id: "100", source: "alpha" },
      { now: () => 1768535319999, store, userId: "user-1" },
    );

    expect(progress.save_time).toBe(1768535315661);
  });

  it("rejects invalid progress input", async () => {
    await expect(
      savePlaybackProgress(
        { id: "100", index: 1, play_time: -1, source: "alpha", total_time: 1247 },
        { store: createPlaybackProgressStore(), userId: "user-1", videoSourceStore: createVideoSourceStore() },
      ),
    ).rejects.toThrow(PlaybackProgressValidationError);
  });

  it("reads legacy stored progress records that still contain index", async () => {
    const store = createPlaybackProgressStore();
    await store.script(
      "return redis.call(\"HSET\", KEYS[1], ARGV[1], ARGV[2])",
      {
        args: [
          "alpha:100",
          JSON.stringify({
            cover: "https://image.test/poster.jpg",
            douban_id: 0,
            index: 2,
            original_episodes: 3,
            play_time: 1061,
            remarks: "更新至3集",
            save_time: 1768535315661,
            search_title: "",
            source_name: "Alpha Source",
            title: "Alpha Movie",
            total_time: 1247,
            year: "2026",
          }),
        ],
        keys: ["user-1:pr"],
      },
    );

    const progress = await getOrCreateInitialPlaybackProgress(
      { detail: createDetail(), id: "100", source: "alpha" },
      { store, userId: "user-1" },
    );

    expect(progress.play_episodes).toBe(2);
    expect(JSON.parse(store.dumpHash("user-1:pr")["alpha:100"] ?? "{}")).toMatchObject({
      play_episodes: 2,
    });
  });
});
