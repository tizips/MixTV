import { describe, expect, it, vi } from "vitest";
import {
  writeEdgeOneKvHash,
  writeEdgeOneKvString,
} from "@/infrastructure/db/edgeone-kv-db-adapter";
import { FakeEdgeOneKvBinding } from "../../../../tests/helpers/fake-edgeone-kv";
import { readPlaybackCacheEntry, readPlaybackSourcesCacheEntry } from "./playback-cache";

describe("playback cache", () => {
  it("does not print cache read details", async () => {
    const consoleInfoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const cacheStore = new FakeEdgeOneKvBinding();
    await writeEdgeOneKvHash(cacheStore, "cache:playback:sources", {
      alpha: JSON.stringify({
        id: "resource-1",
        key: "alpha",
        name: "测试源",
        order: 0,
        quality: "1080P",
        source_name: "测试源",
        total_episodes: 1,
      }),
    });
    await writeEdgeOneKvString(cacheStore, "cache:video:alpha:resource-1", JSON.stringify({
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
    }));

    const detail = await readPlaybackCacheEntry(cacheStore, "cache:video:alpha:resource-1");
    const sources = await readPlaybackSourcesCacheEntry(cacheStore, "cache:playback:sources");

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
      }),
    ]);
    expect(consoleInfoSpy).not.toHaveBeenCalled();
  });
});
