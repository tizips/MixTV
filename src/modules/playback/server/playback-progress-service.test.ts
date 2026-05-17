import { describe, expect, it, vi } from "vitest";
import { listPlaybackHistory } from "@/modules/history/server/history-service";
import { savePlaybackProgress } from "./playback-progress-service";

function createVideoSourceStore() {
  return {
    script: vi.fn(async () => ({
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
    })),
  };
}

describe("playback progress storage", () => {
  it("stores index on saved playback progress records", async () => {
    const writes: Array<{ field: string; payload: string }> = [];
    const store = {
      script: vi.fn(async (_script: string, options: { args?: string[] }) => {
        if (options.args) {
          writes.push({ field: options.args[0], payload: options.args[1] });
        }

        return null;
      }),
    };

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
        store: store as never,
        userId: "user-1",
        videoSourceStore: createVideoSourceStore() as never,
      },
    );

    expect(writes).toHaveLength(1);
    expect(writes[0]).toEqual({
      field: "alpha:resource-1",
      payload: expect.any(String),
    });

    expect(JSON.parse(writes[0].payload)).toEqual(
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
    const store = {
      script: vi.fn(async () => ({
        "alpha:resource-1": JSON.stringify({
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
        }),
      })),
    };

    const history = await listPlaybackHistory("user-1", { store: store as never });

    expect(history).toHaveLength(1);
    expect(history[0].id).toBe("resource-1");
    expect(history[0].source).toBe("alpha");
    expect(history[0].title).toBe("测试剧集");
    expect(history[0].index).toBeUndefined();
  });

  it("migrates legacy playback history records that still use numeric index", async () => {
    const store = {
      script: vi.fn(async (_script: string, options: { args?: string[] }) => {
        if (!options.args) {
          return {
            "alpha:resource-1": JSON.stringify({
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
            }),
          };
        }

        return options.args[1];
      }),
    };

    const history = await listPlaybackHistory("user-1", { store: store as never });

    expect(history).toHaveLength(1);
    expect(history[0].play_episodes).toBe(2);
    expect(history[0].index).toBeUndefined();
  });
});
