import { createDbAdapter } from "@/infrastructure/db/db-adapter";
import type { DbPort } from "@/shared/db/db-port";
import type { VideoSourceResource } from "@/integrations/video-sources";

export type PlaybackCacheStore = DbPort<unknown, string>;

const playbackCacheTtlSeconds = 60 * 60;

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

const readPlaybackCacheScript = `
return redis.call("GET", KEYS[1])
`;

const savePlaybackCacheScript = `
redis.call("SET", KEYS[1], ARGV[1], "EX", ARGV[2])
return 1
`;

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
  return createDbAdapter<unknown>({ namespace: "" });
}

export function createPlaybackCacheKey(sourceKey: string, id: string) {
  return `cache:video:${sourceKey}:${id}`;
}

export async function readPlaybackCacheEntry(cacheStore: PlaybackCacheStore, cacheKey: string) {
  try {
    return parseCachedResource(
      await cacheStore.script(readPlaybackCacheScript, {
        keys: [cacheKey],
        readOnly: true,
      }),
    );
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
    await cacheStore.script(savePlaybackCacheScript, {
      args: [JSON.stringify(createPlaybackCachePayload(resource)), playbackCacheTtlSeconds],
      keys: [cacheKey],
    });
  } catch {
    // Playback should still work when cache storage is temporarily unavailable.
  }
}
