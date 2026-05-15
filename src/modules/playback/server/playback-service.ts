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
import type { DbPort } from "@/shared/db/db-port";
import { createPlaceholderImageUrl } from "@/shared/media/placeholder-image";
import type { PlayPageData, VideoSource } from "../domain/playback-page-data";
import {
  getOrCreateInitialPlaybackProgress,
  type PlaybackProgressStore,
} from "./playback-progress-service";

export type PlaybackPageResult =
  | { status: "ready"; data: PlayPageData }
  | { status: "error"; error: string };

export interface PlaybackPageOptions {
  cacheStore?: PlaybackCacheStore;
  detailFetcher?: typeof getVideoSourceDetail;
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
const playbackCacheTtlSeconds = 2 * 60 * 60;

export type PlaybackCacheStore = DbPort<unknown, string>;

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

function parseCachedResource(value: unknown): VideoSourceResource | null {
  if (typeof value !== "string") {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as unknown;

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }

    const resource = parsed as Partial<VideoSourceResource>;

    if (
      typeof resource.id !== "string" ||
      typeof resource.sourceKey !== "string" ||
      typeof resource.title !== "string" ||
      !Array.isArray(resource.episodes) ||
      !Array.isArray(resource.episodeTitles)
    ) {
      return null;
    }

    return resource as VideoSourceResource;
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
      args: [JSON.stringify(resource), playbackCacheTtlSeconds],
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
    fetcher,
    now,
    progressStore,
    timeoutMs,
    userId,
    videoSourceStore = createVideoSourceStore(),
  } = options;
  const source = await findEnabledSource(sourceKey, videoSourceStore);

  if (!source) {
    return { status: "error", error: "未找到可用片源，无法加载播放信息。" };
  }

  try {
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
      return { status: "error", error: "当前资源没有可播放地址。" };
    }

    const playbackProgress = userId
      ? await getOrCreateInitialPlaybackProgress(
          {
            detail: resource,
            id,
            source: sourceKey,
          },
          {
            ...(now ? { now } : {}),
            ...(progressStore ? { store: progressStore } : {}),
            userId,
          },
        )
      : null;
    const sources = createPlaybackSources(resource.episodes, resource.episodeTitles);
    const title = resource.title || "未知影片";

    return {
      status: "ready",
      data: {
        title,
        originalTitle: resource.typeName ?? resource.className ?? resource.sourceName,
        currentEpisode: playbackProgress?.index ?? 1,
        posterUrl: resource.posterUrl || createPlaceholderImageUrl({
          variant: "poster",
          fileStem: title,
          seed: `${resource.sourceKey}-${resource.id}`,
        }),
        progressId: id,
        progressSource: sourceKey,
        resumeTimeSeconds: playbackProgress?.play_time,
        year: resource.year,
        area: resource.sourceName,
        category: resource.className ?? resource.typeName ?? "未知",
        rating: "暂无",
        sourceName: resource.sourceName,
        description: resource.description || "暂无简介。",
        tags: createTags(resource),
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
