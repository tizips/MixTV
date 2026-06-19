import { describe, expect, it, vi } from "vitest";
import { readPlaybackCacheEntry, readPlaybackSourcesCacheEntry } from "./playback-cache";

describe("playback cache", () => {
  it("does not print cache read details", async () => {
    const consoleInfoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const cacheStore = {
      script: vi.fn(async (script: string) => {
        if (script.includes("HGETALL")) {
          return {
            alpha: JSON.stringify({
              id: "resource-1",
              key: "alpha",
              name: "测试源",
              order: 0,
              ping: 42,
              probe_url: "https://alpha.test/api.php/provide/vod",
              quality: "1080P",
              source_name: "测试源",
              total_episodes: 1,
            }),
          };
        }

        if (script.includes("GET")) {
          return JSON.stringify({
            cover: "https://example.com/poster.jpg",
            description: "简介",
            episodes: ["EP1"],
            id: "resource-1",
            idx: "douban:123",
            key: "alpha",
            remarks: "",
            source: "测试源",
            tag: "电视剧",
            title: "测试剧集",
            total_episodes: 1,
            year: "2026",
          });
        }

        return null;
      }),
    };

    const detail = await readPlaybackCacheEntry(cacheStore as never, "cache:video:alpha:resource-1");
    const sources = await readPlaybackSourcesCacheEntry(cacheStore as never, "cache:playback:sources");

    expect(detail).toEqual(
      expect.objectContaining({
        id: "resource-1",
        sourceKey: "alpha",
        title: "测试剧集",
      }),
    );
    expect(sources).toEqual([
      expect.objectContaining({
        id: "resource-1",
        key: "alpha",
        name: "测试源",
        probe_url: "https://alpha.test/api.php/provide/vod",
      }),
    ]);
    expect(sources?.[0]).not.toHaveProperty("ping");
    expect(consoleInfoSpy).not.toHaveBeenCalled();
  });
});
