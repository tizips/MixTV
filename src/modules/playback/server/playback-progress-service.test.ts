import { describe, expect, it } from "vitest";
import { listPlaybackHistory } from "@/modules/history/server/history-service";
import { savePlaybackProgress } from "./playback-progress-service";
import {
  createEdgeOneKvHashStore,
  dumpEdgeOneKvHash,
  FakeEdgeOneKvBinding,
  seedEdgeOneKvHash,
} from "../../../../tests/helpers/fake-edgeone-kv";

function createVideoSourceStore() {
  return createEdgeOneKvHashStore({
    sources: {
      alpha: JSON.stringify({
        adult: false,
        apiUrl: "https://example.com/api",
        key: "alpha",
        name: "测试源",
        no: 1,
        status: "enabled",
        type: "normal",
        validity: "valid",
        weight: 1,
        updatedAt: null,
      }),
    },
  }, { namespace: "admin" });
}

describe("playback progress storage", () => {
  it("stores index on saved playback progress records", async () => {
    const store = new FakeEdgeOneKvBinding();

    const result = await savePlaybackProgress(
      {
        id: "resource-1",
        play_episodes: 3,
        play_time: 180,
        source: "alpha",
        total_time: 240,
      },
      {
        detailFetcher: async () =>
          ({
            className: "电视剧",
            episodes: [{}, {}, {}],
            posterUrl: "https://example.com/poster.jpg",
            remarks: "",
            sourceName: "测试源",
            title: "测试剧集",
            typeName: "电视剧",
            year: "2026",
          }) as never,
        now: () => 123456789,
        store,
        userId: "user-1",
        videoSourceStore: await createVideoSourceStore(),
      },
    );

    const progressHash = await dumpEdgeOneKvHash(store, "user-1:pr", { namespace: "user" });
    expect(JSON.parse(progressHash["alpha:resource-1"] ?? "{}")).toEqual(
      expect.objectContaining({
        index: "2026:tv:测试剧集",
        play_episodes: 3,
        source_name: "测试源",
        title: "测试剧集",
        year: "2026",
      }),
    );
    expect(result.index).toBe("2026:tv:测试剧集");
  });

  it("reads legacy playback history records without index", async () => {
    const store = new FakeEdgeOneKvBinding();
    await seedEdgeOneKvHash(store, "user-1:pr", {
      "alpha:resource-1": {
        cover: "https://example.com/poster.jpg",
        douban_id: 0,
        original_episodes: 3,
        play_episodes: 1,
        play_time: 0,
        remarks: "",
        save_time: 123456789,
        search_title: "",
        source_name: "测试源",
        title: "测试剧集",
        total_time: 240,
        year: "2026",
      },
    }, { namespace: "user" });

    const history = await listPlaybackHistory("user-1", { store });

    expect(history).toHaveLength(1);
    expect(history[0].id).toBe("resource-1");
    expect(history[0].source).toBe("alpha");
    expect(history[0].title).toBe("测试剧集");
    expect(history[0].index).toBeUndefined();
  });

  it("migrates legacy playback history records that still use numeric index", async () => {
    const store = new FakeEdgeOneKvBinding();
    await seedEdgeOneKvHash(store, "user-1:pr", {
      "alpha:resource-1": {
        cover: "https://example.com/poster.jpg",
        douban_id: 0,
        index: 2,
        original_episodes: 3,
        play_time: 0,
        remarks: "",
        save_time: 123456789,
        search_title: "",
        source_name: "测试源",
        title: "测试剧集",
        total_time: 240,
        year: "2026",
      },
    }, { namespace: "user" });

    const history = await listPlaybackHistory("user-1", { store });

    expect(history).toHaveLength(1);
    expect(history[0].play_episodes).toBe(2);
    expect(history[0].index).toBeUndefined();
  });
});
