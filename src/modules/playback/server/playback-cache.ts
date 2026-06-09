import {
  getEdgeOneKvBinding,
  readEdgeOneKvHash,
  readEdgeOneKvString,
  type EdgeOneKvBinding,
  writeEdgeOneKvHash,
  writeEdgeOneKvString,
} from "@/infrastructure/db/edgeone-kv-db-adapter";
import type { VideoSourceResource } from "@/integrations/video-sources";

export type PlaybackCacheStore = EdgeOneKvBinding;

const playbackCacheKvBindingName = "cache";
const playbackCacheTtlSeconds = 60 * 60;
const playbackSourcesCacheTtlSeconds = 60 * 60;

interface PlaybackDetailCachePayload {
  total_episodes: number;
  id: string;
  idx: string;
  key: string;
  cover: string;
  source: string;
  title: string;
  year: string;
  remarks: string;
  tag: string;
  episodes: string[];
  description: string;
}

export interface PlaybackSourceCacheItem {
  id: string;
  key: string;
  name: string;
  quality?: string;
  source_name: string;
  total_episodes: number;
}

type PlaybackSourcesCachePayload = PlaybackSourceCacheItem & {
  order: number;
  quality: string | undefined;
};

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function parseDoubanId(idx: string) {
  if (!idx.startsWith("douban:")) {
    return undefined;
  }

  const id = Number(idx.slice("douban:".length));
  return Number.isFinite(id) ? id : undefined;
}

function parseDetailCachePayload(value: Record<string, unknown>): PlaybackDetailCachePayload | null {
  if (
    typeof value.total_episodes !== "number" ||
    typeof value.id !== "string" ||
    typeof value.idx !== "string" ||
    typeof value.key !== "string" ||
    typeof value.cover !== "string" ||
    typeof value.source !== "string" ||
    typeof value.title !== "string" ||
    typeof value.year !== "string" ||
    typeof value.remarks !== "string" ||
    typeof value.tag !== "string" ||
    typeof value.description !== "string" ||
    !isStringArray(value.episodes)
  ) {
    return null;
  }

  return {
    description: value.description,
    id: value.id,
    idx: value.idx,
    key: value.key,
    cover: value.cover,
    source: value.source,
    title: value.title,
    year: value.year,
    remarks: value.remarks,
    tag: value.tag,
    episodes: value.episodes,
    total_episodes: value.total_episodes,
  };
}

function convertDetailCachePayloadToResource(payload: PlaybackDetailCachePayload): VideoSourceResource {
  return {
    description: payload.description,
    doubanId: parseDoubanId(payload.idx),
    episodes: payload.episodes,
    id: payload.id,
    posterUrl: payload.cover,
    remarks: payload.remarks,
    sourceKey: payload.key,
    sourceName: payload.source,
    title: payload.title,
    typeName: payload.tag,
    year: payload.year,
  };
}

function parseCachedResource(value: unknown): VideoSourceResource | null {
  if (typeof value !== "string") {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as unknown;

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }

    const payload = parseDetailCachePayload(parsed as Record<string, unknown>);
    return payload ? convertDetailCachePayloadToResource(payload) : null;
  } catch {
    return null;
  }
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

function isPlaybackSourcesCachePayload(value: unknown): value is PlaybackSourcesCachePayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const payload = value as Record<string, unknown>;

  return typeof payload.order === "number"
    && typeof payload.id === "string"
    && typeof payload.key === "string"
    && typeof payload.name === "string"
    && (typeof payload.quality === "string" || payload.quality === undefined)
    && typeof payload.source_name === "string"
    && typeof payload.total_episodes === "number";
}

function parsePlaybackSourcesCachePayload(value: unknown): PlaybackSourcesCachePayload | null {
  if (typeof value !== "string") {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return isPlaybackSourcesCachePayload(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function createPlaybackCachePayload(resource: VideoSourceResource): PlaybackDetailCachePayload {
  return {
    total_episodes: resource.episodes.length,
    id: resource.id,
    idx: resource.doubanId ? `douban:${resource.doubanId}` : "",
    key: resource.sourceKey,
    cover: resource.posterUrl,
    source: resource.sourceName,
    title: resource.title,
    year: resource.year,
    remarks: resource.remarks ?? "",
    tag: resource.typeName ?? resource.className ?? "",
    episodes: resource.episodes,
    description: resource.description,
  };
}

export function createPlaybackCacheStore(): PlaybackCacheStore {
  return getEdgeOneKvBinding({
    bindingName: playbackCacheKvBindingName,
  });
}

export function createPlaybackCacheKey(sourceKey: string, id: string) {
  return `cache:video:${sourceKey}:${id}`;
}

export function createPlaybackSourcesCacheKey(index: string) {
  return index.trim();
}

export async function readPlaybackCacheEntry(cacheStore: PlaybackCacheStore, cacheKey: string) {
  try {
    return parseCachedResource(await readEdgeOneKvString(cacheStore, cacheKey));
  } catch {
    return null;
  }
}

export async function savePlaybackCacheEntry(
  cacheStore: PlaybackCacheStore,
  cacheKey: string,
  resource: VideoSourceResource,
) {
  try {
    await writeEdgeOneKvString(cacheStore, cacheKey, JSON.stringify(createPlaybackCachePayload(resource)), {
      ttlSeconds: playbackCacheTtlSeconds,
    });
  } catch {
    // Playback should still work when cache storage is temporarily unavailable.
  }
}

function isPlaybackSourcesCacheItem(value: unknown): value is PlaybackSourceCacheItem[] {
  if (!Array.isArray(value)) {
    return false;
  }
  return value.every((source) => {
    if (!source || typeof source !== "object" || Array.isArray(source)) {
      return false;
    }

    const item = source as Record<string, unknown>;

    return typeof item.id === "string"
      && typeof item.key === "string"
      && typeof item.name === "string"
      && (typeof item.quality === "string" || item.quality === undefined)
      && typeof item.source_name === "string"
      && typeof item.total_episodes === "number";
  });
}

export async function readPlaybackSourcesCacheEntry(cacheStore: PlaybackCacheStore, cacheKey: string) {
  try {
    const record = toHashRecord(await readEdgeOneKvHash(cacheStore, cacheKey));

    const entries = Object.entries(record)
      .map(([field, value]) => {
        const payload = parsePlaybackSourcesCachePayload(value);

        if (!payload) {
          return null;
        }

        return {
          ...payload,
          quality: payload.quality || undefined,
          key: field,
        };
      })
      .filter((entry): entry is PlaybackSourcesCachePayload => entry !== null)
      .sort((left, right) => left.order - right.order)
      .map((item) => ({
        id: item.id,
        key: item.key,
        name: item.name,
        quality: item.quality,
        source_name: item.source_name,
        total_episodes: item.total_episodes,
      }));

    if (entries.length === 0) {
      return null;
    }

    return isPlaybackSourcesCacheItem(entries) ? entries : null;
  } catch {
    return null;
  }
}

export async function savePlaybackSourcesCacheEntry(
  cacheStore: PlaybackCacheStore,
  cacheKey: string,
  payload: PlaybackSourceCacheItem[],
) {
  if (payload.length === 0) {
    return;
  }

  try {
    await writeEdgeOneKvHash(
      cacheStore,
      cacheKey,
      Object.fromEntries(
        payload.map((item, order) => [
          item.key,
          JSON.stringify({
            id: item.id,
            key: item.key,
            name: item.name,
            order,
            quality: item.quality ?? "",
            source_name: item.source_name,
            total_episodes: item.total_episodes,
          }),
        ]),
      ),
      { ttlSeconds: playbackSourcesCacheTtlSeconds },
    );
  } catch {
    // Playback source lookup should still work when cache storage is temporarily unavailable.
  }
}
