import {
  deleteEdgeOneKvHashField,
  getEdgeOneKvBinding,
  patchEdgeOneKvHash,
  readEdgeOneKvHash,
  type EdgeOneKvBinding,
} from "@/infrastructure/db/edgeone-kv-db-adapter";

export interface MediaSearchCacheEntry {
  id: string;
  quality: string;
  resourceKey: string;
  name: string;
  total_episodes: number;
}

export type MediaSearchCacheStore = EdgeOneKvBinding;

const mediaSearchCacheKvBindingName = "cache";
const mediaSearchCacheTtlSeconds = 60 * 60;
let mediaSearchCacheStore: MediaSearchCacheStore | null = null;

function createMediaSearchCacheHashKey(index: string) {
  return index.trim();
}

function createMediaSearchCacheStore(): MediaSearchCacheStore {
  mediaSearchCacheStore ??= getEdgeOneKvBinding({
    bindingName: mediaSearchCacheKvBindingName,
  });

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

    await patchEdgeOneKvHash(store, cacheKey, {
      [resourceKey]: JSON.stringify({
        id: entry.id,
        name: entry.name,
        quality: entry.quality,
        total_episodes: entry.total_episodes,
      }),
    }, { ttlSeconds: mediaSearchCacheTtlSeconds });
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

  const record = toHashRecord(await readEdgeOneKvHash(store, createMediaSearchCacheHashKey(normalizedIndex)));

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
          typeof entry.name !== "string" ||
          (typeof entry.total_episodes !== "number" && entry.total_episodes !== undefined)
        ) {
          return null;
        }

        return {
          id: entry.id,
          name: entry.name,
          quality: entry.quality,
          resourceKey,
          total_episodes: entry.total_episodes ?? 0,
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

  await deleteEdgeOneKvHashField(store, createMediaSearchCacheHashKey(normalizedIndex), normalizedResourceKey);
}
