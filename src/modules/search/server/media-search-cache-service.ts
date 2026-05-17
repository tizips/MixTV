import { createDbAdapter } from "@/infrastructure/db/db-adapter";
import type { DbPort } from "@/shared/db/db-port";

export interface MediaSearchCacheEntry {
  id: string;
  quality: string;
  resourceKey: string;
  name: string;
}

export type MediaSearchCacheStore = DbPort<unknown, string>;

const mediaSearchCacheTtlSeconds = 7 * 24 * 60 * 60;
let mediaSearchCacheStore: MediaSearchCacheStore | null = null;

const saveMediaSearchCacheScript = `
redis.call("HSET", KEYS[1], ARGV[1], ARGV[2])
redis.call("EXPIRE", KEYS[1], ARGV[3])
return ARGV[2]
`;

const readMediaSearchCacheScript = `
return redis.call("HGETALL", KEYS[1])
`;

const deleteMediaSearchCacheScript = `
redis.call("HDEL", KEYS[1], ARGV[1])
if redis.call("HLEN", KEYS[1]) == 0 then
  redis.call("DEL", KEYS[1])
end
return 1
`;

function createMediaSearchCacheHashKey(index: string) {
  return index.trim();
}

function createMediaSearchCacheStore(): MediaSearchCacheStore {
  mediaSearchCacheStore ??= createDbAdapter<unknown>({ namespace: "" });

  return mediaSearchCacheStore;
}

function toHashRecord(value: unknown): Record<string, string> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return Object.fromEntries(
      Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
    );
  }

  if (!Array.isArray(value)) {
    return {};
  }

  const record: Record<string, string> = {};

  for (let index = 0; index < value.length; index += 2) {
    const key = value[index];
    const fieldValue = value[index + 1];

    if (typeof key === "string" && typeof fieldValue === "string") {
      record[key] = fieldValue;
    }
  }

  return record;
}

export async function saveMediaSearchCacheEntries(
  index: string,
  entries: MediaSearchCacheEntry[],
  { store = createMediaSearchCacheStore() }: { store?: MediaSearchCacheStore } = {},
) {
  const normalizedIndex = index.trim();

  if (!normalizedIndex || entries.length === 0) {
    return;
  }

  const cacheKey = createMediaSearchCacheHashKey(normalizedIndex);

  for (const entry of entries) {
    const resourceKey = entry.resourceKey.trim();

    if (!resourceKey) {
      continue;
    }

    await store.script(saveMediaSearchCacheScript, {
      args: [resourceKey, JSON.stringify({
        id: entry.id,
        quality: entry.quality,
        name: entry.name,
      }), mediaSearchCacheTtlSeconds],
      keys: [cacheKey],
    });
  }
}

export async function readMediaSearchCacheEntries(
  index: string,
  { store = createMediaSearchCacheStore() }: { store?: MediaSearchCacheStore } = {},
) {
  const normalizedIndex = index.trim();

  if (!normalizedIndex) {
    return [];
  }

  const record = toHashRecord(
    await store.script(readMediaSearchCacheScript, {
      keys: [createMediaSearchCacheHashKey(normalizedIndex)],
      readOnly: true,
    }),
  );

  return Object.entries(record)
    .map(([resourceKey, value]) => {
      try {
        const parsed = JSON.parse(value) as unknown;

        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          return null;
        }

        const entry = parsed as Partial<MediaSearchCacheEntry>;

        if (
          typeof entry.id !== "string" ||
          typeof entry.quality !== "string" ||
          typeof entry.name !== "string"
        ) {
          return null;
        }

        return {
          id: entry.id,
          name: entry.name,
          quality: entry.quality,
          resourceKey,
        };
      } catch {
        return null;
      }
    })
    .filter((entry): entry is MediaSearchCacheEntry => entry !== null);
}

export async function deleteMediaSearchCacheEntry(
  index: string,
  resourceKey: string,
  { store = createMediaSearchCacheStore() }: { store?: MediaSearchCacheStore } = {},
) {
  const normalizedIndex = index.trim();
  const normalizedResourceKey = resourceKey.trim();

  if (!normalizedIndex || !normalizedResourceKey) {
    return;
  }

  await store.script(deleteMediaSearchCacheScript, {
    args: [normalizedResourceKey],
    keys: [createMediaSearchCacheHashKey(normalizedIndex)],
  });
}
