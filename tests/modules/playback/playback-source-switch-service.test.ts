import { describe, expect, it, vi } from "vitest";
import type { VideoSourceResource } from "@/integrations/video-sources";
import type { VideoSourceStore } from "@/modules/admin/server/video-source-service";
import {
  switchPlaybackSource,
} from "@/modules/playback/server/playback-source-switch-service";
import {
  createEdgeOneKvHashStore,
  dumpEdgeOneKvHash,
} from "../../helpers/fake-edgeone-kv";

function createUserHashStore(initialValues: Record<string, Record<string, unknown>> = {}) {
  return createEdgeOneKvHashStore(initialValues, { namespace: "user" });
}

function createCacheStore() {
  return createEdgeOneKvHashStore();
}

async function createVideoSourceStore(): Promise<VideoSourceStore> {
  return createEdgeOneKvHashStore({
    sources: {
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
    },
  }, { namespace: "admin" });
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
    const progressStore = await createUserHashStore({
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
    const cacheStore = await createCacheStore();
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
        videoSourceStore: await createVideoSourceStore(),
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
    const progressHash = await dumpEdgeOneKvHash(progressStore, "user-1:pr", { namespace: "user" });
    expect(progressHash["alpha:80474"]).toBeDefined();
    expect(progressHash["beta:80473"]).toBeUndefined();
  });

  it("moves an existing favorite to the switched source", async () => {
    const progressStore = await createUserHashStore();
    const favoriteStore = await createUserHashStore({
      "user-1:fav": {
        "beta:80473": JSON.stringify({
          cover: "https://image.test/old.jpg",
          douban_id: 0,
          original_episodes: 12,
          remarks: "更新至12集",
          save_time: 1768535315661,
          search_title: "",
          source_name: "Beta Source",
          title: "深空彼岸",
          year: "2026",
        }),
      },
    });
    const detailFetcher = vi.fn(async () => createDetail());

    await switchPlaybackSource(
      {
        current: { id: "80473", source: "beta" },
        play_episodes: 2,
        play_time: 125,
        target: { id: "80474", source: "alpha" },
        total_time: 2708,
      },
      {
        cacheStore: await createCacheStore(),
        detailFetcher,
        favoriteStore,
        progressStore,
        userId: "user-1",
        videoSourceStore: await createVideoSourceStore(),
      },
    );

    const favorites = await dumpEdgeOneKvHash(favoriteStore, "user-1:fav", { namespace: "user" });

    expect(favorites["beta:80473"]).toBeUndefined();
    expect(JSON.parse(favorites["alpha:80474"])).toMatchObject({
      cover: "https://image.test/poster.jpg",
      original_episodes: 3,
      source_name: "Alpha Source",
      title: "深空彼岸",
    });
  });
});
