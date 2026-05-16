import { describe, expect, it, vi } from "vitest";
import type { DbPort, DbScriptOptions } from "@/shared/db/db-port";
import { deleteHistoryPlaybackProgress, listPlaybackHistory } from "@/modules/history/server/history-service";

type ScriptHistoryStore = DbPort<unknown, string> & {
  dumpHash: (key: string) => Record<string, string>;
};

function createHistoryStore(initialValues: Record<string, string> = {}): ScriptHistoryStore {
  const hashes = new Map<string, Record<string, string>>([["user-1:pr", { ...initialValues }]]);

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
      const hash = hashes.get(key) ?? {};

      if (script.includes("HDEL")) {
        delete hash[field];
        hashes.set(key, hash);

        return Object.entries(hash).flat() as TResult;
      }

      if (script.includes("HGETALL")) {
        return Object.entries(hash).flat() as TResult;
      }

      return null as TResult;
    },
    set: vi.fn(async () => undefined),
  };
}

describe("history service", () => {
  it("lists playback history ordered by most recent save time", async () => {
    const store = createHistoryStore({
      "alpha:100": JSON.stringify({
        cover: "https://image.test/one.jpg",
        douban_id: 0,
        index: 2,
        original_episodes: 12,
        play_time: 1061,
        remarks: "更新至12集",
        save_time: 1768471200000,
        search_title: "",
        source_name: "Alpha",
        title: "Alpha Movie",
        total_episodes: 12,
        total_time: 1247,
        year: "2026",
      }),
      "beta:200": JSON.stringify({
        cover: "https://image.test/two.jpg",
        douban_id: 0,
        index: 1,
        original_episodes: 8,
        play_time: 25,
        remarks: "更新至8集",
        save_time: 1768535315661,
        search_title: "",
        source_name: "Beta",
        title: "Beta Movie",
        total_episodes: 8,
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
    const store = createHistoryStore({
      "alpha:100": JSON.stringify({
        cover: "https://image.test/one.jpg",
        douban_id: 0,
        index: 2,
        original_episodes: 12,
        play_time: 1061,
        remarks: "更新至12集",
        save_time: 1768471200000,
        search_title: "",
        source_name: "Alpha",
        title: "Alpha Movie",
        total_episodes: 12,
        total_time: 1247,
        year: "2026",
      }),
      "beta:200": JSON.stringify({
        cover: "https://image.test/two.jpg",
        douban_id: 0,
        index: 1,
        original_episodes: 8,
        play_time: 25,
        remarks: "更新至8集",
        save_time: 1768535315661,
        search_title: "",
        source_name: "Beta",
        title: "Beta Movie",
        total_episodes: 8,
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
