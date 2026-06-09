import { describe, expect, it, vi } from "vitest";
import { countHistoryUpdates } from "./history-update-service";
import {
  FakeEdgeOneKvBinding,
  seedEdgeOneKvHash,
} from "../../../../tests/helpers/fake-edgeone-kv";

function createHistoryRecord(overrides: Record<string, unknown> = {}) {
  return {
    cover: "https://example.com/poster.jpg",
    douban_id: 1,
    play_episodes: 1,
    original_episodes: 1,
    play_time: 120,
    remarks: "",
    save_time: Date.now(),
    search_title: "test",
    source_name: "测试源",
    title: "测试剧集",
    total_time: 240,
    year: "2026",
    ...overrides,
  };
}

describe("countHistoryUpdates", () => {
  it("counts only stored history items whose saved total is newer than the original total", async () => {
    const historyStore = new FakeEdgeOneKvBinding();
    await seedEdgeOneKvHash(historyStore, "user-1:pr", {
      "alpha:movie-1": createHistoryRecord({ original_episodes: 3, play_episodes: 1 }),
      "alpha:movie-2": createHistoryRecord({
        original_episodes: 4,
        play_episodes: 2,
        save_time: Date.now() - 31 * 24 * 60 * 60 * 1000,
      }),
      "alpha:movie-3": createHistoryRecord({ original_episodes: 4, play_episodes: 4 }),
    }, { namespace: "user" });

    const detailFetcher = vi.fn(async () => {
      throw new Error("detail fetch should not run when counting stored update data");
    });

    const result = await countHistoryUpdates("user-1", {
      detailFetcher: detailFetcher as never,
      historyStore,
    });

    expect(result).toEqual({ history: 2 });
    expect(detailFetcher).not.toHaveBeenCalled();
  });
});
