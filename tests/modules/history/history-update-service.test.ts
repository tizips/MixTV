import { describe, expect, it, vi } from "vitest";
import { checkAllHistoryUpdates, checkHistoryUpdates } from "@/modules/history/server/history-update-service";
import type { VideoSourceStore } from "@/modules/admin/server/video-source-service";
import {
  createEdgeOneKvHashStore,
  dumpEdgeOneKvHash,
} from "../../helpers/fake-edgeone-kv";

function createHistoryStore(initialValues: Record<string, Record<string, string>> = {}) {
  return createEdgeOneKvHashStore(initialValues, { namespace: "user" });
}

function createCacheStore(initialValues: Record<string, Record<string, string>> = {}) {
  return createEdgeOneKvHashStore(initialValues);
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

function createHistoryRecord(overrides: Partial<Record<string, unknown>> = {}) {
  return JSON.stringify({
    cover: "https://image.test/poster.jpg",
    douban_id: 0,
    original_episodes: 12,
    play_time: 1061,
    play_episodes: 2,
    remarks: "更新至12集",
    save_time: 1768471200000,
    search_title: "",
    source_name: "Alpha Source",
    title: "Alpha Movie",
    total_time: 1247,
    year: "2026",
    ...overrides,
  });
}

describe("checkHistoryUpdates", () => {
  it("skips history older than 30 days", async () => {
    const now = 1768535315661;
    const historyStore = await createHistoryStore({
      "user-1:pr": {
        "alpha:100": createHistoryRecord({ save_time: now - 31 * 24 * 60 * 60 * 1000 }),
        "alpha:101": createHistoryRecord({ original_episodes: 10, save_time: now - 2 * 24 * 60 * 60 * 1000 }),
      },
    });
    const cacheStore = await createCacheStore();
    const detailFetcher = vi.fn(async () => ({
      description: "detail",
      episodeTitles: ["1", "2"],
      episodes: ["https://alpha.test/1.m3u8", "https://alpha.test/2.m3u8"],
      id: "101",
      posterUrl: "https://image.test/poster.jpg",
      remarks: "更新至2集",
      sourceKey: "alpha",
      sourceName: "Alpha Source",
      title: "Alpha Movie",
      year: "2026",
    }));

    const events = [];

    for await (const event of checkHistoryUpdates("user-1", {
      cacheStore,
      detailFetcher,
      historyStore,
      now: () => now,
      videoSourceStore: await createVideoSourceStore(),
    })) {
      events.push(event);
    }

    expect(events.map((event) => event.type)).toEqual(["start", "unchanged", "skip", "done"]);
    expect(detailFetcher).toHaveBeenCalledTimes(1);
    await expect(dumpEdgeOneKvHash(cacheStore, "cache:update:alpha:101")).resolves.toEqual({
      original_episodes: "2",
    });
  });

  it("updates history totals and caches update checks for 2 hours", async () => {
    const historyStore = await createHistoryStore({
      "user-1:pr": {
        "alpha:100": createHistoryRecord({ original_episodes: 12 }),
      },
    });
    const cacheStore = await createCacheStore();
    const detailFetcher = vi.fn(async () => ({
      description: "detail",
      episodeTitles: Array.from({ length: 14 }, (_, index) => String(index + 1)),
      episodes: Array.from({ length: 14 }, (_, index) => `https://alpha.test/${index + 1}.m3u8`),
      id: "100",
      posterUrl: "https://image.test/poster.jpg",
      remarks: "更新至14集",
      sourceKey: "alpha",
      sourceName: "Alpha Source",
      title: "Alpha Movie",
      year: "2026",
    }));

    const events = [];

    for await (const event of checkHistoryUpdates("user-1", {
      cacheStore,
      detailFetcher,
      historyStore,
      now: () => 1768535315661,
      videoSourceStore: await createVideoSourceStore(),
    })) {
      events.push(event);
    }

    expect(events.some((event) => event.type === "update" && event.updated)).toBe(true);
    expect(JSON.parse((await dumpEdgeOneKvHash(historyStore, "user-1:pr", { namespace: "user" }))["alpha:100"] ?? "{}")).toMatchObject({
      original_episodes: 14,
    });
    await expect(dumpEdgeOneKvHash(cacheStore, "cache:update:alpha:100")).resolves.toEqual({
      original_episodes: "14",
    });
  });

  it("reuses the same cache for different users", async () => {
    const cacheStore = await createCacheStore({
      "cache:update:alpha:100": {
        original_episodes: "14",
      },
    });
    const detailFetcher = vi.fn(async () => {
      throw new Error("detail fetch should not run when cache is shared");
    });

    const firstUserHistoryStore = await createHistoryStore({
      "user-1:pr": {
        "alpha:100": createHistoryRecord({ original_episodes: 12 }),
      },
    });
    const secondUserHistoryStore = await createHistoryStore({
      "user-2:pr": {
        "alpha:100": createHistoryRecord({ original_episodes: 10 }),
      },
    });

    const firstEvents = [];
    for await (const event of checkHistoryUpdates("user-1", {
      cacheStore,
      detailFetcher,
      historyStore: firstUserHistoryStore,
      now: () => 1768535315661,
      videoSourceStore: await createVideoSourceStore(),
    })) {
      firstEvents.push(event);
    }

    const secondEvents = [];
    for await (const event of checkHistoryUpdates("user-2", {
      cacheStore,
      detailFetcher,
      historyStore: secondUserHistoryStore,
      now: () => 1768535315661,
      videoSourceStore: await createVideoSourceStore(),
    })) {
      secondEvents.push(event);
    }

    expect(firstEvents.some((event) => event.type === "update" && event.updated)).toBe(true);
    expect(secondEvents.some((event) => event.type === "update" && event.updated)).toBe(true);
    expect(detailFetcher).not.toHaveBeenCalled();
  });
});

describe("checkAllHistoryUpdates", () => {
  it("updates history for every user and keeps the shared cache hot", async () => {
    const historyStore = await createHistoryStore({
      "user-1:pr": {
        "alpha:100": createHistoryRecord({ original_episodes: 12 }),
      },
      "user-2:pr": {
        "alpha:100": createHistoryRecord({ original_episodes: 10 }),
      },
    });
    const cacheStore = await createCacheStore();
    const detailFetcher = vi.fn(async () => ({
      description: "detail",
      episodeTitles: Array.from({ length: 14 }, (_, index) => String(index + 1)),
      episodes: Array.from({ length: 14 }, (_, index) => `https://alpha.test/${index + 1}.m3u8`),
      id: "100",
      posterUrl: "https://image.test/poster.jpg",
      remarks: "更新至14集",
      sourceKey: "alpha",
      sourceName: "Alpha Source",
      title: "Alpha Movie",
      year: "2026",
    }));

    const summary = await checkAllHistoryUpdates({
      cacheStore,
      detailFetcher,
      historyStore,
      now: () => 1768535315661,
      videoSourceStore: await createVideoSourceStore(),
    });

    expect(summary).toMatchObject({
      checked: 2,
      errors: 0,
      skipped: 0,
      updated: 2,
      users: 2,
    });
    expect(detailFetcher).toHaveBeenCalledTimes(1);
    expect(JSON.parse((await dumpEdgeOneKvHash(historyStore, "user-1:pr", { namespace: "user" }))["alpha:100"] ?? "{}")).toMatchObject({
      original_episodes: 14,
    });
    expect(JSON.parse((await dumpEdgeOneKvHash(historyStore, "user-2:pr", { namespace: "user" }))["alpha:100"] ?? "{}")).toMatchObject({
      original_episodes: 14,
    });
  });
});
