import { describe, expect, it, vi } from "vitest";
import type { VideoSourceResource } from "@/integrations/video-sources";
import type { VideoSourceStore } from "@/modules/admin/server/video-source-service";
import {
  getOrCreateInitialPlaybackProgress,
  migratePlaybackProgressRecord,
  savePlaybackProgress,
  PlaybackProgressValidationError,
} from "@/modules/playback/server/playback-progress-service";
import {
  createEdgeOneKvHashStore,
  dumpEdgeOneKvHash,
  seedEdgeOneKvHash,
} from "../../helpers/fake-edgeone-kv";

function createPlaybackProgressStore(initialValues: Record<string, unknown> = {}) {
  return createEdgeOneKvHashStore({
    "user-1:pr": initialValues,
  }, { namespace: "user" });
}

async function createVideoSourceStore(): Promise<VideoSourceStore> {
  return createEdgeOneKvHashStore({
    sources: {
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
    },
  }, { namespace: "admin" });
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
    const store = await createPlaybackProgressStore();
    const detailFetcher = vi.fn(async () => createDetail());

    const progress = await savePlaybackProgress(
      { id: "100", play_episodes: 2, play_time: 1061, source: "alpha", total_time: 1247 },
      {
        detailFetcher,
        now: () => 1768535315661,
        store,
        userId: "user-1",
        videoSourceStore: await createVideoSourceStore(),
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
      index: "2026:unknown:alphamovie",
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
    expect(JSON.parse((await dumpEdgeOneKvHash(store, "user-1:pr", { namespace: "user" }))["alpha:100"] ?? "{}")).toEqual({
      cover: "https://image.test/poster.jpg",
      douban_id: 0,
      index: "2026:unknown:alphamovie",
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
    const store = await createPlaybackProgressStore();

    const progress = await getOrCreateInitialPlaybackProgress(
      { detail: createDetail(), id: "100", source: "alpha" },
      { now: () => 1768535315661, store, userId: "user-1" },
    );

    expect(progress.play_episodes).toBe(1);
    expect(progress.play_time).toBe(0);
    expect(progress.total_time).toBe(0);
    expect(JSON.parse((await dumpEdgeOneKvHash(store, "user-1:pr", { namespace: "user" }))["alpha:100"] ?? "{}")).toMatchObject({
      play_episodes: 1,
      play_time: 0,
      total_time: 0,
    });
  });

  it("returns existing initial progress without overwriting it", async () => {
    const store = await createPlaybackProgressStore();
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
        { id: "100", play_episodes: 1, play_time: -1, source: "alpha", total_time: 1247 },
        { store: await createPlaybackProgressStore(), userId: "user-1", videoSourceStore: await createVideoSourceStore() },
      ),
    ).rejects.toThrow(PlaybackProgressValidationError);
  });

  it("reads legacy stored progress records that still contain index", async () => {
    const store = await createPlaybackProgressStore();
    await seedEdgeOneKvHash(store, "user-1:pr", {
      "alpha:100": {
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
      },
    }, { namespace: "user" });

    const progress = await getOrCreateInitialPlaybackProgress(
      { detail: createDetail(), id: "100", source: "alpha" },
      { store, userId: "user-1" },
    );

    expect(progress.play_episodes).toBe(2);
    expect(JSON.parse((await dumpEdgeOneKvHash(store, "user-1:pr", { namespace: "user" }))["alpha:100"] ?? "{}")).toMatchObject({
      play_episodes: 2,
    });
  });

  it("migrates playback progress to a new source and removes the old record", async () => {
    const store = await createPlaybackProgressStore({
      "alpha:80474": JSON.stringify({
        cover: "https://image.test/alpha.jpg",
        douban_id: 0,
        index: "2026:unknown:alphamovie",
        original_episodes: 2,
        play_time: 125,
        play_episodes: 2,
        remarks: "更新至2集",
        save_time: 1768535315661,
        search_title: "",
        source_name: "Alpha Source",
        title: "Alpha Movie",
        total_time: 1247,
        year: "2026",
      }),
    });
    const videoSourceStore: VideoSourceStore = await createEdgeOneKvHashStore({
      sources: {
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
        beta: JSON.stringify({
          adult: false,
          apiUrl: "https://beta.test/api",
          key: "beta",
          name: "Beta Source",
          no: 2,
          status: "enabled",
          type: "normal",
          updatedAt: null,
          validity: "valid",
          weight: 20,
        }),
      },
    }, { namespace: "admin" });

    const progress = await migratePlaybackProgressRecord(
      { id: "90001", play_episodes: 2, play_time: 125, source: "beta", total_time: 1247 },
      {
        detail: createDetail({
          episodes: ["https://beta.test/1.m3u8", "https://beta.test/2.m3u8"],
          id: "90001",
          posterUrl: "https://image.test/beta.jpg",
          sourceKey: "beta",
          sourceName: "Beta Source",
          title: "Alpha Movie",
        }),
        now: () => 1768535319999,
        previousProgress: { id: "80474", source: "alpha" },
        store,
        userId: "user-1",
        videoSourceStore,
      },
    );

    expect(progress.source).toBe("beta");
    expect(progress.id).toBe("90001");
    const progressHash = await dumpEdgeOneKvHash(store, "user-1:pr", { namespace: "user" });
    expect(JSON.parse(progressHash["beta:90001"] ?? "{}")).toMatchObject({
      play_episodes: 2,
      play_time: 125,
      source_name: "Beta Source",
    });
    expect(progressHash["alpha:80474"]).toBeUndefined();
  });
});
