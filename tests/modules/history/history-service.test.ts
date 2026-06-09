import { describe, expect, it } from "vitest";
import { deleteHistoryPlaybackProgress, listPlaybackHistory } from "@/modules/history/server/history-service";
import { createEdgeOneKvHashStore } from "../../helpers/fake-edgeone-kv";

function createHistoryStore(initialValues: Record<string, string> = {}) {
  return createEdgeOneKvHashStore({
    "user-1:pr": initialValues,
  }, { namespace: "user" });
}

describe("history service", () => {
  it("lists playback history ordered by most recent save time", async () => {
    const store = await createHistoryStore({
      "alpha:100": JSON.stringify({
        cover: "https://image.test/one.jpg",
        douban_id: 0,
        original_episodes: 12,
        play_time: 1061,
        play_episodes: 2,
        remarks: "更新至12集",
        save_time: 1768471200000,
        search_title: "",
        source_name: "Alpha",
        title: "Alpha Movie",
        total_time: 1247,
        year: "2026",
      }),
      "beta:200": JSON.stringify({
        cover: "https://image.test/two.jpg",
        douban_id: 0,
        original_episodes: 8,
        play_time: 25,
        play_episodes: 1,
        remarks: "更新至8集",
        save_time: 1768535315661,
        search_title: "",
        source_name: "Beta",
        title: "Beta Movie",
        total_time: 900,
        year: "2025",
      }),
    });

    await expect(listPlaybackHistory("user-1", { store })).resolves.toEqual([
      expect.objectContaining({ id: "200", source: "beta", title: "Beta Movie" }),
      expect.objectContaining({ id: "100", source: "alpha", title: "Alpha Movie" }),
    ]);
  });

  it("deletes a history entry and returns the remaining list", async () => {
    const store = await createHistoryStore({
      "alpha:100": JSON.stringify({
        cover: "https://image.test/one.jpg",
        douban_id: 0,
        original_episodes: 12,
        play_time: 1061,
        play_episodes: 2,
        remarks: "更新至12集",
        save_time: 1768471200000,
        search_title: "",
        source_name: "Alpha",
        title: "Alpha Movie",
        total_time: 1247,
        year: "2026",
      }),
      "beta:200": JSON.stringify({
        cover: "https://image.test/two.jpg",
        douban_id: 0,
        original_episodes: 8,
        play_time: 25,
        play_episodes: 1,
        remarks: "更新至8集",
        save_time: 1768535315661,
        search_title: "",
        source_name: "Beta",
        title: "Beta Movie",
        total_time: 900,
        year: "2025",
      }),
    });

    await expect(
      deleteHistoryPlaybackProgress("user-1", { id: "200", source: "beta" }, { store }),
    ).resolves.toEqual([
      expect.objectContaining({ id: "100", source: "alpha", title: "Alpha Movie" }),
    ]);
  });
});
