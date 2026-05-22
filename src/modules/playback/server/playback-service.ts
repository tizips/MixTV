import {
  getVideoSourceDetail,
  type VideoSourceAdapterOptions,
  type VideoSourceEndpoint,
  type VideoSourceResource,
} from "@/integrations/video-sources";
import { createDbAdapter } from "@/infrastructure/db/db-adapter";
import {
  createVideoSourceStore,
  getVideoSources,
  type VideoSourceItem,
  type VideoSourceStore,
} from "@/modules/admin";
import { hasFavorite, type FavoriteStore } from "@/modules/favorites/server/favorite-service";
import type { DbPort } from "@/shared/db/db-port";
import { createPlaceholderImageUrl } from "@/shared/media/placeholder-image";
import { createMediaSearchIndex } from "@/shared/media/search-index";
import type { PlayPageData, VideoSource } from "../domain/playback-page-data";
import {
  findPlaybackProgressByIndex,
  getOrCreateInitialPlaybackProgress,
  migratePlaybackProgressRecord,
  type PlaybackProgressStore,
} from "./playback-progress-service";

export type PlaybackPageResult =
  | { status: "ready"; data: PlayPageData }
  | { status: "error"; error: string };

export interface PlaybackPageOptions {
  cacheStore?: PlaybackCacheStore;
  detailFetcher?: typeof getVideoSourceDetail;
  favoriteStore?: FavoriteStore;
  fetcher?: VideoSourceAdapterOptions["fetcher"];
  now?: () => number;
  progressStore?: PlaybackProgressStore;
  timeoutMs?: number;
  userId?: string;
  videoSourceStore?: VideoSourceStore;
}

export interface PlaybackPageQuery {
  id?: string | string[];
  source?: string | string[];
}

const missingPlaybackQueryMessage = "缺少 source 或 id 参数，无法加载播放信息。";
const playbackCacheTtlSeconds = 60 * 60;

export type PlaybackCacheStore = DbPort<unknown, string>;

interface ThirdPartyDetailCachePayload {
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

export function createPlaybackCacheStore(): PlaybackCacheStore {
  return createDbAdapter<unknown>({ namespace: "" });
}

function readSingleParam(value: string | string[] | undefined) {
  const rawValue = Array.isArray(value) ? value[0] : value;
  return rawValue?.trim() || "";
}

function toEndpoint(source: VideoSourceItem): VideoSourceEndpoint {
  return {
    apiUrl: source.apiUrl,
    key: source.key,
    name: source.name,
  };
}

function createPlaybackCacheKey(sourceKey: string, id: string) {
  return `cache:video:${sourceKey}:${id}`;
}

function normalizeTitleForCacheIndex(title: string) {
  return title
    .trim()
    .toLowerCase()
    .replace(/[：:]/g, " ")
    .replace(/\s+/g, "")
    .replace(/第(一|二|三|四|五|六|七|八|九|十|\d+)(季|部)$/g, "");
}

function createCacheIndex(resource: VideoSourceResource) {
  if (resource.doubanId) {
    return `douban:${resource.doubanId}`;
  }

  const title = normalizeTitleForCacheIndex(resource.title);
  const year = resource.year.trim();
  const tag = resource.typeName?.trim() || resource.className?.trim();

  if (title && year && year !== "unknown") {
    return `title:${title}:year:${year}`;
  }

  if (title && tag) {
    return `title:${title}:type:${tag}`;
  }

  return `source:${resource.sourceKey}:${resource.id}`;
}

function createThirdPartyDetailCachePayload(resource: VideoSourceResource): ThirdPartyDetailCachePayload {
  return {
    total_episodes: resource.episodes.length,
    id: resource.id,
    idx: createCacheIndex(resource),
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

function parseDetailCachePayload(value: Record<string, unknown>): ThirdPartyDetailCachePayload | null {
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

function convertDetailCachePayloadToResource(payload: ThirdPartyDetailCachePayload): VideoSourceResource {
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

async function readCachedResource(cacheStore: PlaybackCacheStore, cacheKey: string) {
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

async function saveCachedResource(cacheStore: PlaybackCacheStore, cacheKey: string, resource: VideoSourceResource) {
  try {
    await cacheStore.script(savePlaybackCacheScript, {
      args: [JSON.stringify(createThirdPartyDetailCachePayload(resource)), playbackCacheTtlSeconds],
      keys: [cacheKey],
    });
  } catch {
    // Playback should still work when cache storage is temporarily unavailable.
  }
}

async function findEnabledSource(sourceKey: string, store: VideoSourceStore) {
  const collection = await getVideoSources(store);
  return collection.sources.find((source) => source.key === sourceKey && source.status === "enabled") ?? null;
}

function createEpisodeTitle(title: string | undefined, index: number) {
  const normalizedTitle = title?.trim();
  return normalizedTitle || `第${index + 1}集`;
}

function createPlaybackSources(episodes: string[], episodeTitles: string[]): VideoSource[] {
  return episodes.map((url, index) => ({
    id: `episode-${index + 1}`,
    name: createEpisodeTitle(episodeTitles[index], index),
    url,
    quality: "HLS",
    latency: "在线播放",
    status: "流畅",
  }));
}

function createTags(resource: Awaited<ReturnType<typeof getVideoSourceDetail>>) {
  return [
    resource.remarks,
    resource.typeName ?? resource.className,
    resource.year && resource.year !== "unknown" ? resource.year : undefined,
    `${resource.episodes.length} 集`,
  ].filter((tag): tag is string => Boolean(tag));
}

async function readPlaybackFavoriteState({
  favoriteStore,
  id,
  sourceKey,
  userId,
}: {
  favoriteStore?: FavoriteStore;
  id: string;
  sourceKey: string;
  userId?: string;
}) {
  if (!userId) {
    return false;
  }

  try {
    return await hasFavorite(
      userId,
      {
        id,
        source: sourceKey,
      },
      {
        ...(favoriteStore ? { store: favoriteStore } : {}),
      },
    );
  } catch {
    return false;
  }
}

async function loadPlaybackResource(
  sourceKey: string,
  id: string,
  {
    cacheStore,
    detailFetcher,
    fetcher,
    timeoutMs,
    videoSourceStore,
  }: {
    cacheStore: PlaybackCacheStore;
    detailFetcher: typeof getVideoSourceDetail;
    fetcher?: VideoSourceAdapterOptions["fetcher"];
    timeoutMs?: number;
    videoSourceStore: VideoSourceStore;
  },
) {
  const source = await findEnabledSource(sourceKey, videoSourceStore);

  if (!source) {
    return { status: "missing_source" as const };
  }

  const cacheKey = createPlaybackCacheKey(sourceKey, id);
  const cachedResource = await readCachedResource(cacheStore, cacheKey);
  const resource = cachedResource ?? await detailFetcher(toEndpoint(source), id, {
    ...(fetcher ? { fetcher } : {}),
    ...(timeoutMs === undefined ? {} : { timeoutMs }),
  });

  if (!cachedResource) {
    await saveCachedResource(cacheStore, cacheKey, resource);
  }

  if (resource.episodes.length === 0) {
    return { status: "empty" as const };
  }

  return {
    status: "ready" as const,
    resource,
    source,
  };
}

export async function getPlaybackPageData(
  query: PlaybackPageQuery,
  options: PlaybackPageOptions = {},
): Promise<PlaybackPageResult> {
  const sourceKey = readSingleParam(query.source);
  const id = readSingleParam(query.id);

  if (!sourceKey || !id) {
    return { status: "error", error: missingPlaybackQueryMessage };
  }

  const {
    cacheStore = createPlaybackCacheStore(),
    detailFetcher = getVideoSourceDetail,
    favoriteStore,
    fetcher,
    now,
    progressStore,
    timeoutMs,
    userId,
    videoSourceStore = createVideoSourceStore(),
  } = options;
  try {
    const requested = await loadPlaybackResource(sourceKey, id, {
      cacheStore,
      detailFetcher,
      fetcher,
      timeoutMs,
      videoSourceStore,
    });

    if (requested.status === "missing_source") {
      return { status: "error", error: "未找到可用片源，无法加载播放信息。" };
    }

    if (requested.status === "empty") {
      return { status: "error", error: "当前资源没有可播放地址。" };
    }

    const activeResource = requested.resource;
    let playbackProgress = null;

    if (userId && progressStore) {
      const matchedProgress = await findPlaybackProgressByIndex(
        userId,
        createMediaSearchIndex({
          className: requested.resource.className,
          title: requested.resource.title,
          typeName: requested.resource.typeName,
          year: requested.resource.year,
        }),
        { store: progressStore },
      );

      if (matchedProgress) {
        if (matchedProgress.source !== sourceKey || matchedProgress.id !== id) {
          playbackProgress = await migratePlaybackProgressRecord(
            {
              id,
              play_episodes: matchedProgress.play_episodes,
              play_time: matchedProgress.play_time,
              source: sourceKey,
              total_time: matchedProgress.total_time,
            },
            {
              ...(now ? { now } : {}),
              ...(progressStore ? { store: progressStore } : {}),
              detail: requested.resource,
              previousProgress: matchedProgress,
              userId,
              videoSourceStore,
            },
          );
        } else {
          playbackProgress = matchedProgress;
        }
      }
    }

    if (!playbackProgress && userId) {
      playbackProgress = await getOrCreateInitialPlaybackProgress(
        {
          detail: activeResource,
          id,
          source: sourceKey,
        },
        {
          ...(now ? { now } : {}),
          ...(progressStore ? { store: progressStore } : {}),
          userId,
        },
      );
    }

    const isFavorite = await readPlaybackFavoriteState({
      favoriteStore,
      id,
      sourceKey,
      userId,
    });
    const sources = createPlaybackSources(activeResource.episodes, activeResource.episodeTitles ?? []);
    const title = activeResource.title || "未知影片";
    const coverDefault = createPlaceholderImageUrl({
      variant: "poster",
      fileStem: title,
      seed: `${activeResource.sourceKey}-${activeResource.id}`,
    });

    return {
      status: "ready",
      data: {
        title,
        original_title: activeResource.typeName ?? activeResource.className ?? activeResource.sourceName,
        play_episodes: playbackProgress?.play_episodes ?? 1,
        cover_default: coverDefault,
        cover: activeResource.posterUrl || coverDefault,
        index: createMediaSearchIndex({
          className: activeResource.className,
          title: activeResource.title,
          typeName: activeResource.typeName,
          year: activeResource.year,
        }),
        progress_id: id,
        progress_source: sourceKey,
        play_time: playbackProgress?.play_time,
        is_favorite: isFavorite,
        year: activeResource.year,
        area: activeResource.sourceName,
        category: activeResource.className ?? activeResource.typeName ?? "未知",
        rating: "暂无",
        source_name: activeResource.sourceName,
        description: activeResource.description || "暂无简介。",
        tags: createTags(activeResource),
        episodes: sources.map((sourceItem, index) => ({
          number: index + 1,
          title: sourceItem.name,
          duration: "未知",
        })),
        sources,
      },
    };
  } catch (error) {
    console.error("Failed to load playback detail.", error);
    return { status: "error", error: "播放信息加载失败，请稍后重试。" };
  }
}
