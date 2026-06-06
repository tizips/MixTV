import { describe, expect, it } from "vitest";
import { createEdgeOneKvDbAdapter, type EdgeOneKvBinding } from "@/infrastructure/db/edgeone-kv-db-adapter";

class FakeEdgeOneKvBinding implements EdgeOneKvBinding {
  readonly values = new Map<string, string>();

  async delete(key: string) {
    this.values.delete(key);
  }

  async get(key: string) {
    return this.values.get(key) ?? null;
  }

  async list({ cursor, limit = 1000, prefix = "" }: { cursor?: string; limit?: number; prefix?: string } = {}) {
    const offset = cursor ? Number(cursor) : 0;
    const keys = [...this.values.keys()].filter((key) => key.startsWith(prefix)).sort();
    const page = keys.slice(offset, offset + limit);
    const nextOffset = offset + page.length;

    return {
      cursor: nextOffset < keys.length ? String(nextOffset) : "",
      keys: page.map((name) => ({ name })),
      list_complete: nextOffset >= keys.length,
    };
  }

  async put(key: string, value: string) {
    this.values.set(key, value);
  }
}

const readHashScript = `
return redis.call("HGETALL", KEYS[1])
`;

const readHashFieldScript = `
return redis.call("HGET", KEYS[1], ARGV[1])
`;

const saveHashFieldScript = `
redis.call("HSET", KEYS[1], ARGV[1], ARGV[2])
return ARGV[2]
`;

const deleteHashFieldScript = `
redis.call("HDEL", KEYS[1], ARGV[1])
return redis.call("HGETALL", KEYS[1])
`;

const migrateHashFieldScript = `
local current = redis.call("HGET", KEYS[1], ARGV[1])
if not current then
  return nil
end
redis.call("HSET", KEYS[1], ARGV[2], ARGV[3])
redis.call("HDEL", KEYS[1], ARGV[1])
return ARGV[3]
`;

const scanHistoryKeysScript = `
local cursor = "0"
local keys = {}

repeat
  local result = redis.call("SCAN", cursor, "MATCH", ARGV[1], "COUNT", ARGV[2])
  cursor = result[1]
  local batch = result[2]

  for index = 1, #batch do
    keys[#keys + 1] = batch[index]
  end
until cursor == "0"

return keys
`;

const cleanupExpiredCacheKvScript = `
local cursor = "0"
local scanned = 0
local deleted = 0

repeat
  local result = redis.call("SCAN", cursor, "MATCH", ARGV[1], "COUNT", ARGV[2])
  cursor = result[1]
  local batch = result[2]

  for index = 1, #batch do
    scanned = scanned + 1
    local raw = redis.call("GET", batch[index])
    if raw then
      local payload = cjson.decode(raw)
      if type(payload.expiresAt) == "number" and payload.expiresAt <= tonumber(ARGV[3]) then
        redis.call("DEL", batch[index])
        deleted = deleted + 1
      end
    end
  end
until cursor == "0"

return { scanned = scanned, deleted = deleted }
`;

describe("edgeone kv db adapter", () => {
  it("sets, gets, and deletes values through EdgeOne KV-safe keys", async () => {
    const binding = new FakeEdgeOneKvBinding();
    const db = createEdgeOneKvDbAdapter<{ id: string; title: string }>({
      binding,
      namespace: "movies",
    });

    await db.set("movie:100", { id: "100", title: "Alpha" });
    await expect(db.get("movie:100")).resolves.toEqual({ id: "100", title: "Alpha" });
    await db.del("movie:100");

    expect([...binding.values.keys()].every((key) => /^[A-Za-z0-9_]+$/.test(key))).toBe(true);
    await expect(db.get("movie:100")).resolves.toBeNull();
  });

  it("emulates the hash scripts used by playback progress, history, and favorites", async () => {
    const binding = new FakeEdgeOneKvBinding();
    const db = createEdgeOneKvDbAdapter({ binding, namespace: "user" });
    const rawProgress = JSON.stringify({ title: "Alpha Movie" });

    await expect(
      db.script(saveHashFieldScript, {
        args: ["alpha:100", rawProgress],
        keys: ["user-1:pr"],
      }),
    ).resolves.toBe(rawProgress);

    await expect(
      db.script(readHashFieldScript, {
        args: ["alpha:100"],
        keys: ["user-1:pr"],
        readOnly: true,
      }),
    ).resolves.toBe(rawProgress);
    await expect(
      db.script(readHashScript, {
        keys: ["user-1:pr"],
        readOnly: true,
      }),
    ).resolves.toEqual(["alpha:100", rawProgress]);
    await expect(
      db.script(deleteHashFieldScript, {
        args: ["alpha:100"],
        keys: ["user-1:pr"],
      }),
    ).resolves.toEqual([]);
  });

  it("emulates the favorite migration script atomically within one KV record", async () => {
    const binding = new FakeEdgeOneKvBinding();
    const db = createEdgeOneKvDbAdapter({ binding, namespace: "user" });

    await expect(
      db.script(migrateHashFieldScript, {
        args: ["alpha:100", "beta:200", JSON.stringify({ title: "Beta Movie" })],
        keys: ["user-1:fav"],
      }),
    ).resolves.toBeNull();

    await db.script(saveHashFieldScript, {
      args: ["alpha:100", JSON.stringify({ title: "Alpha Movie" })],
      keys: ["user-1:fav"],
    });

    const migrated = JSON.stringify({ title: "Beta Movie" });

    await expect(
      db.script(migrateHashFieldScript, {
        args: ["alpha:100", "beta:200", migrated],
        keys: ["user-1:fav"],
      }),
    ).resolves.toBe(migrated);
    await expect(
      db.script(readHashScript, {
        keys: ["user-1:fav"],
        readOnly: true,
      }),
    ).resolves.toEqual(["beta:200", migrated]);
  });

  it("returns Redis-like namespaced keys for history scans", async () => {
    const binding = new FakeEdgeOneKvBinding();
    const db = createEdgeOneKvDbAdapter({ binding, namespace: "user" });

    await db.script(saveHashFieldScript, {
      args: ["alpha:100", "{}"],
      keys: ["user-1:pr"],
    });
    await db.script(saveHashFieldScript, {
      args: ["alpha:101", "{}"],
      keys: ["user-2:pr"],
    });
    await db.script(saveHashFieldScript, {
      args: ["alpha:102", "{}"],
      keys: ["user-2:fav"],
    });

    await expect(
      db.script(scanHistoryKeysScript, {
        args: ["*:pr", 1000],
        readOnly: true,
      }),
    ).resolves.toEqual(["user:user-1:pr", "user:user-2:pr"]);
  });

  it("emulates the list scripts used by search history", async () => {
    const binding = new FakeEdgeOneKvBinding();
    const db = createEdgeOneKvDbAdapter({ binding, namespace: "user" });
    const addSearchHistoryScript = `
redis.call("LREM", KEYS[1], 0, ARGV[1])
redis.call("LPUSH", KEYS[1], ARGV[1])
redis.call("LTRIM", KEYS[1], 0, tonumber(ARGV[2]))
return redis.call("LRANGE", KEYS[1], 0, tonumber(ARGV[2]))
`;
    const deleteSearchHistoryScript = `
redis.call("LREM", KEYS[1], 0, ARGV[1])
return redis.call("LRANGE", KEYS[1], 0, tonumber(ARGV[2]))
`;

    await db.script(addSearchHistoryScript, {
      args: ["Alpha", 1],
      keys: ["user-1:sh"],
    });
    await expect(
      db.script(addSearchHistoryScript, {
        args: ["Beta", 1],
        keys: ["user-1:sh"],
      }),
    ).resolves.toEqual(["Beta", "Alpha"]);
    await expect(
      db.script(deleteSearchHistoryScript, {
        args: ["Alpha", 1],
        keys: ["user-1:sh"],
      }),
    ).resolves.toEqual(["Beta"]);
  });

  it("emulates constant-field hash scripts used by admin configuration", async () => {
    const binding = new FakeEdgeOneKvBinding();
    const db = createEdgeOneKvDbAdapter({ binding, namespace: "admin" });
    const saveConfigScript = `
redis.call("HSET", KEYS[1], "siteName", ARGV[1], "showAdultContent", ARGV[2], "updatedAt", ARGV[3])
return 1
`;

    await expect(
      db.script(saveConfigScript, {
        args: ["MixTV", "false", "2026-06-06T00:00:00.000Z"],
        keys: ["site-config"],
      }),
    ).resolves.toBe(1);
    await expect(
      db.script(readHashScript, {
        keys: ["site-config"],
        readOnly: true,
      }),
    ).resolves.toEqual([
      "siteName",
      "MixTV",
      "showAdultContent",
      "false",
      "updatedAt",
      "2026-06-06T00:00:00.000Z",
    ]);
  });

  it("emulates string cache scripts with lazy expiration", async () => {
    const binding = new FakeEdgeOneKvBinding();
    let currentTime = 1768435200000;
    const db = createEdgeOneKvDbAdapter({
      binding,
      namespace: "",
      now: () => currentTime,
    });
    const saveCacheScript = `
redis.call("SET", KEYS[1], ARGV[1], "EX", ARGV[2])
return 1
`;
    const readCacheScript = `
return redis.call("GET", KEYS[1])
`;

    await db.script(saveCacheScript, {
      args: ["cached-value", 1],
      keys: ["cache:video:alpha:100"],
    });

    await expect(
      db.script(readCacheScript, {
        keys: ["cache:video:alpha:100"],
        readOnly: true,
      }),
    ).resolves.toBe("cached-value");

    currentTime += 1001;

    await expect(
      db.script(readCacheScript, {
        keys: ["cache:video:alpha:100"],
        readOnly: true,
      }),
    ).resolves.toBeNull();
  });

  it("cleans expired entries across the cache KV binding", async () => {
    const binding = new FakeEdgeOneKvBinding();
    let currentTime = 1768435200000;
    const cacheDb = createEdgeOneKvDbAdapter({
      binding,
      namespace: "",
      now: () => currentTime,
    });
    const statsDb = createEdgeOneKvDbAdapter({
      binding,
      namespace: "stats",
      now: () => currentTime,
    });
    const saveCacheScript = `
redis.call("SET", KEYS[1], ARGV[1], "EX", ARGV[2])
return 1
`;
    const readCacheScript = `
return redis.call("GET", KEYS[1])
`;
    const recordStatScript = `
local fieldPrefix = ARGV[1]
local ttl = tonumber(ARGV[6])

redis.call("HINCRBY", KEYS[1], fieldPrefix .. ":count", tonumber(ARGV[2]))
redis.call("HINCRBY", KEYS[1], fieldPrefix .. ":duration", tonumber(ARGV[3]))
redis.call("HINCRBY", KEYS[1], fieldPrefix .. ":success", tonumber(ARGV[4]))
redis.call("HINCRBY", KEYS[1], fieldPrefix .. ":fail", tonumber(ARGV[5]))
redis.call("EXPIRE", KEYS[1], ttl)
return 1
`;

    await cacheDb.script(saveCacheScript, {
      args: ["expired-cache", 1],
      keys: ["cache:video:expired"],
    });
    await cacheDb.script(saveCacheScript, {
      args: ["fresh-cache", 60],
      keys: ["cache:video:fresh"],
    });
    await cacheDb.set("cache:manual", { retained: true });
    await statsDb.script(recordStatScript, {
      args: ["api:00:00", 1, 20, 1, 0, 1],
      keys: ["day:2026-01-15"],
    });
    binding.values.set("external_raw_key", "leave me alone");

    currentTime += 1001;

    await expect(
      cacheDb.script(cleanupExpiredCacheKvScript, {
        args: ["*", 1000, currentTime],
      }),
    ).resolves.toEqual({ deleted: 2, scanned: 4 });
    await expect(
      cacheDb.script(readCacheScript, {
        keys: ["cache:video:expired"],
        readOnly: true,
      }),
    ).resolves.toBeNull();
    await expect(
      cacheDb.script(readCacheScript, {
        keys: ["cache:video:fresh"],
        readOnly: true,
      }),
    ).resolves.toBe("fresh-cache");
    await expect(cacheDb.get("cache:manual")).resolves.toEqual({ retained: true });
    await expect(
      statsDb.script(readHashScript, {
        keys: ["day:2026-01-15"],
        readOnly: true,
      }),
    ).resolves.toEqual([]);
    expect(binding.values.get("external_raw_key")).toBe("leave me alone");
  });

  it("emulates the HINCRBY stats script", async () => {
    const binding = new FakeEdgeOneKvBinding();
    const db = createEdgeOneKvDbAdapter({ binding, namespace: "stats" });
    const recordStatScript = `
local fieldPrefix = ARGV[1]
local countDelta = tonumber(ARGV[2])
local durationDelta = tonumber(ARGV[3])
local successDelta = tonumber(ARGV[4])
local failDelta = tonumber(ARGV[5])
local ttl = tonumber(ARGV[6])

if countDelta ~= 0 then
  redis.call("HINCRBY", KEYS[1], fieldPrefix .. ":count", countDelta)
end

if durationDelta ~= 0 then
  redis.call("HINCRBY", KEYS[1], fieldPrefix .. ":duration", durationDelta)
end

if successDelta ~= 0 then
  redis.call("HINCRBY", KEYS[1], fieldPrefix .. ":success", successDelta)
end

if failDelta ~= 0 then
  redis.call("HINCRBY", KEYS[1], fieldPrefix .. ":fail", failDelta)
end

redis.call("EXPIRE", KEYS[1], ttl)
return 1
`;

    await db.script(recordStatScript, {
      args: ["api:12:30", 1, 25, 1, 0, 60],
      keys: ["day:2026-06-06"],
    });
    await db.script(recordStatScript, {
      args: ["api:12:30", 1, 10, 0, 1, 60],
      keys: ["day:2026-06-06"],
    });

    await expect(
      db.script(readHashScript, {
        keys: ["day:2026-06-06"],
        readOnly: true,
      }),
    ).resolves.toEqual([
      "api:12:30:count",
      "2",
      "api:12:30:duration",
      "35",
      "api:12:30:success",
      "1",
      "api:12:30:fail",
      "1",
    ]);
  });

  it("throws a clear error for unsupported scripts", async () => {
    const binding = new FakeEdgeOneKvBinding();
    const db = createEdgeOneKvDbAdapter({ binding, namespace: "user" });

    await expect(db.script("return redis.call(\"ZADD\", KEYS[1], ARGV[1], ARGV[2])")).rejects.toThrow(
      "EdgeOne KV adapter does not support this storage script.",
    );
  });

  it("can resolve a bound namespace from a global EdgeOne variable name", async () => {
    const binding = new FakeEdgeOneKvBinding();
    const globalWithBinding = globalThis as typeof globalThis & { mixtv_kv?: EdgeOneKvBinding };
    globalWithBinding.mixtv_kv = binding;

    try {
      const db = createEdgeOneKvDbAdapter({
        bindingName: "mixtv_kv",
        namespace: "user",
      });

      await db.set("user-1:settings", { theme: "dark" });

      expect(binding.values.size).toBe(1);
    } finally {
      delete globalWithBinding.mixtv_kv;
    }
  });
});
