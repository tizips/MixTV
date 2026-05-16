import { describe, expect, it, vi } from "vitest";
import { checkAllHistoryUpdates, checkHistoryUpdates } from "@/modules/history/server/history-update-service";
import type { VideoSourceStore } from "@/modules/admin/server/video-source-service";
import type { DbPort, DbScriptOptions } from "@/shared/db/db-port";

type ScriptStore = DbPort<unknown, string> & {
  dumpHash: (key: string) => Record<string, string>;
};

function createHistoryStore(initialValues: Record<string, Record<string, string>> = {}): ScriptStore {
  const hashes = new Map<string, Record<string, string>>(Object.entries(initialValues).map(([key, value]) => [key, { ...value }]));

  const script = vi.fn(async (script: string, options?: DbScriptOptions<string>) => {
    const key = options?.keys?.[0] ?? "";
    const field = String(options?.args?.[0] ?? "");
    const value = String(options?.args?.[1] ?? "");
    const hash = hashes.get(key) ?? {};

    if (script.includes("SCAN")) {
      return [...hashes.keys()].map((historyKey) => `user:${historyKey}`);
    }

    if (script.includes("HSET")) {
      hash[field] = value;
      hashes.set(key, hash);
      return Object.entries(hash).flat();
    }

    if (script.includes("HDEL")) {
      delete hash[field];
      hashes.set(key, hash);
      return Object.entries(hash).flat();
    }

    if (script.includes("HGETALL")) {
      return Object.entries(hash).flat();
    }

    if (script.includes("EXPIRE")) {
      return 1;
    }

    return null;
  }) as ScriptStore["script"];

  return {
    del: vi.fn(async (key: string) => {
      hashes.delete(key);
    }),
    dumpHash(key: string) {
      return { ...(hashes.get(key) ?? {}) };
    },
    get: vi.fn(async () => null),
    script,
    set: vi.fn(async () => undefined),
  } as unknown as ScriptStore;
}

function createCacheStore(initialValues: Record<string, Record<string, string>> = {}): ScriptStore {
  const hashes = new Map<string, Record<string, string>>(Object.entries(initialValues).map(([key, value]) => [key, { ...value }]));

  const script = vi.fn(async (script: string, options?: DbScriptOptions<string>) => {
    const key = options?.keys?.[0] ?? "";
    const field = String(options?.args?.[0] ?? "");
    const value = String(options?.args?.[1] ?? "");
    const hash = hashes.get(key) ?? {};

    if (script.includes("HSET")) {
      hash[field] = value;
      hashes.set(key, hash);
      return Object.entries(hash).flat();
    }

    if (script.includes("HGETALL")) {
      return Object.entries(hash).flat();
    }

    if (script.includes("EXPIRE")) {
      return 1;
    }

    return null;
  }) as ScriptStore["script"];

  return {
    del: vi.fn(async (key: string) => {
      hashes.delete(key);
    }),
    dumpHash(key: string) {
      return { ...(hashes.get(key) ?? {}) };
    },
    get: vi.fn(async () => null),
    script,
    set: vi.fn(async () => undefined),
  } as unknown as ScriptStore;
}

function createVideoSourceStore(): VideoSourceStore {
  return {
    del: vi.fn(async () => undefined),
    get: vi.fn(async () => null),
    script: vi.fn(async <TResult = unknown>() => ({
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
    }) as TResult),
    set: vi.fn(async () => undefined),
  } as unknown as VideoSourceStore;
}

function createHistoryRecord(overrides: Partial<Record<string, unknown>> = {}) {
  return JSON.stringify({
    cover: "https://image.test/poster.jpg",
    douban_id: 0,
    index: 2,
    original_episodes: 12,
    play_time: 1061,
    remarks: "更新至12集",
    save_time: 1768471200000,
    search_title: "",
    source_name: "Alpha Source",
    title: "Alpha Movie",
    total_episodes: 12,
    total_time: 1247,
    year: "2026",
    ...overrides,
  });
}

describe("checkHistoryUpdates", () => {
  it("skips history older than 30 days", async () => {
    const now = 1768535315661;
    const historyStore = createHistoryStore({
      "user-1:pr": {
        "alpha:100": createHistoryRecord({ save_time: now - 31 * 24 * 60 * 60 * 1000 }),
        "alpha:101": createHistoryRecord({ save_time: now - 2 * 24 * 60 * 60 * 1000, total_episodes: 10 }),
      },
    });
    const cacheStore = createCacheStore();
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
      videoSourceStore: createVideoSourceStore(),
    })) {
      events.push(event);
    }

    expect(events.map((event) => event.type)).toEqual(["start", "unchanged", "skip", "done"]);
    expect(detailFetcher).toHaveBeenCalledTimes(1);
    expect(cacheStore.script).toHaveBeenCalledWith(
      expect.stringContaining('redis.call("HSET"'),
      expect.objectContaining({
        args: ["total_episodes", 2, 7200],
        keys: ["cache:update:alpha:101"],
      }),
    );
  });

  it("updates history totals and caches update checks for 2 hours", async () => {
    const historyStore = createHistoryStore({
      "user-1:pr": {
        "alpha:100": createHistoryRecord({ total_episodes: 12 }),
      },
    });
    const cacheStore = createCacheStore();
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
      videoSourceStore: createVideoSourceStore(),
    })) {
      events.push(event);
    }

    expect(events.some((event) => event.type === "update" && event.updated)).toBe(true);
    expect(JSON.parse(historyStore.dumpHash("user-1:pr")["alpha:100"] ?? "{}")).toMatchObject({
      total_episodes: 14,
    });
    expect(cacheStore.script).toHaveBeenCalledWith(
      expect.stringContaining('redis.call("HSET"'),
      expect.objectContaining({
        args: ["total_episodes", 14, 7200],
        keys: ["cache:update:alpha:100"],
      }),
    );
  });

  it("reuses the same cache for different users", async () => {
    const cacheStore = createCacheStore({
      "cache:update:alpha:100": {
        total_episodes: "14",
      },
    });
    const detailFetcher = vi.fn(async () => {
      throw new Error("detail fetch should not run when cache is shared");
    });

    const firstUserHistoryStore = createHistoryStore({
      "user-1:pr": {
        "alpha:100": createHistoryRecord({ total_episodes: 12 }),
      },
    });
    const secondUserHistoryStore = createHistoryStore({
      "user-2:pr": {
        "alpha:100": createHistoryRecord({ total_episodes: 10 }),
      },
    });

    const firstEvents = [];
    for await (const event of checkHistoryUpdates("user-1", {
      cacheStore,
      detailFetcher,
      historyStore: firstUserHistoryStore,
      now: () => 1768535315661,
      videoSourceStore: createVideoSourceStore(),
    })) {
      firstEvents.push(event);
    }

    const secondEvents = [];
    for await (const event of checkHistoryUpdates("user-2", {
      cacheStore,
      detailFetcher,
      historyStore: secondUserHistoryStore,
      now: () => 1768535315661,
      videoSourceStore: createVideoSourceStore(),
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
    const historyStore = createHistoryStore({
      "user-1:pr": {
        "alpha:100": createHistoryRecord({ total_episodes: 12 }),
      },
      "user-2:pr": {
        "alpha:100": createHistoryRecord({ total_episodes: 10 }),
      },
    });
    const cacheStore = createCacheStore();
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
      videoSourceStore: createVideoSourceStore(),
    });

    expect(summary).toMatchObject({
      checked: 2,
      errors: 0,
      skipped: 0,
      updated: 2,
      users: 2,
    });
    expect(detailFetcher).toHaveBeenCalledTimes(1);
    expect(JSON.parse(historyStore.dumpHash("user-1:pr")["alpha:100"] ?? "{}")).toMatchObject({
      total_episodes: 14,
    });
    expect(JSON.parse(historyStore.dumpHash("user-2:pr")["alpha:100"] ?? "{}")).toMatchObject({
      total_episodes: 14,
    });
  });
});
