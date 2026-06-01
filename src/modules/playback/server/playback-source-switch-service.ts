import { getVideoSourceDetail, type VideoSourceAdapterOptions, type VideoSourceEndpoint } from "@/integrations/video-sources";
import {
  createVideoSourceStore,
  getVideoSources,
  type VideoSourceStore,
} from "@/modules/admin/server/video-source-service";
import {
  migrateFavoriteRecord,
  type FavoriteStore,
} from "@/modules/favorites/server/favorite-service";
import {
  migratePlaybackProgressRecord,
  type PlaybackProgressStore,
} from "@/modules/playback/server/playback-progress-service";
import {
  createPlaybackCacheKey,
  createPlaybackCacheStore,
  readPlaybackCacheEntry,
  savePlaybackCacheEntry,
  type PlaybackCacheStore,
} from "./playback-cache";

export type PlaybackSourceTrack = {
  id: string;
  name: string;
  url: string;
  quality: string;
  latency: string;
  status: "流畅" | "拥挤" | "维护";
};

export interface PlaybackSourceSwitchInput {
  current: {
    id: string;
    source: string;
  };
  target: {
    id: string;
    source: string;
  };
  play_episodes: number;
  play_time: number;
  total_time: number;
}

export interface PlaybackSourceSwitchOptions {
  cacheStore?: PlaybackCacheStore;
  detailFetcher?: typeof getVideoSourceDetail;
  favoriteStore?: FavoriteStore;
  fetcher?: VideoSourceAdapterOptions["fetcher"];
  progressStore?: PlaybackProgressStore;
  timeoutMs?: number;
  userId: string;
  videoSourceStore?: VideoSourceStore;
}

export interface PlaybackSourceSwitchResult {
  episodes: Array<{ duration: string; number: number; title: string }>;
  progress: {
    id: string;
    play_episodes: number;
    play_time: number;
    source: string;
    total_time: number;
  };
  source_name: string;
  sources: PlaybackSourceTrack[];
}

export class PlaybackSourceSwitchValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlaybackSourceSwitchValidationError";
  }
}

function readRequiredString(value: string, name: string) {
  const text = value.trim();

  if (!text) {
    throw new PlaybackSourceSwitchValidationError(`${name} is required.`);
  }

  return text;
}

function readRequiredPositiveInteger(value: number, name: string) {
  if (!Number.isFinite(value) || value < 1) {
    throw new PlaybackSourceSwitchValidationError(`${name} must be a positive integer.`);
  }

  return Math.floor(value);
}

function readRequiredNonNegativeInteger(value: number, name: string) {
  if (!Number.isFinite(value) || value < 0) {
    throw new PlaybackSourceSwitchValidationError(`${name} must be non-negative.`);
  }

  return Math.floor(value);
}

function toEndpoint(source: { apiUrl: string; key: string; name: string }): VideoSourceEndpoint {
  return {
    apiUrl: source.apiUrl,
    key: source.key,
    name: source.name,
  };
}

function createEpisodeTitle(title: string | undefined, index: number) {
  const normalizedTitle = title?.trim();
  return normalizedTitle || `第${index + 1}集`;
}

function createPlaybackSources(episodes: string[], episodeTitles: string[]): PlaybackSourceTrack[] {
  return episodes.map((url, index) => ({
    id: `episode-${index + 1}`,
    latency: "在线播放",
    name: createEpisodeTitle(episodeTitles[index], index),
    quality: "HLS",
    status: "流畅",
    url,
  }));
}

function createPlaybackEpisodes(episodes: string[], episodeTitles: string[]) {
  return episodes.map((_url, index) => ({
    duration: "未知",
    number: index + 1,
    title: createEpisodeTitle(episodeTitles[index], index),
  }));
}

async function findEnabledSource(sourceKey: string, store: VideoSourceStore) {
  const collection = await getVideoSources(store);
  return collection.sources.find((source) => source.key === sourceKey && source.status === "enabled") ?? null;
}

export async function switchPlaybackSource(
  input: PlaybackSourceSwitchInput,
  {
    cacheStore = createPlaybackCacheStore(),
    detailFetcher = getVideoSourceDetail,
    favoriteStore,
    fetcher,
    progressStore,
    timeoutMs,
    userId,
    videoSourceStore = createVideoSourceStore(),
  }: PlaybackSourceSwitchOptions,
): Promise<PlaybackSourceSwitchResult> {
  const currentSource = readRequiredString(input.current.source, "current.source");
  const currentId = readRequiredString(input.current.id, "current.id");
  const targetSource = readRequiredString(input.target.source, "target.source");
  const targetId = readRequiredString(input.target.id, "target.id");
  const playEpisodes = readRequiredPositiveInteger(input.play_episodes, "play_episodes");
  const playTime = readRequiredNonNegativeInteger(input.play_time, "play_time");
  const totalTime = readRequiredNonNegativeInteger(input.total_time, "total_time");
  const source = await findEnabledSource(targetSource, videoSourceStore);

  if (!source) {
    throw new PlaybackSourceSwitchValidationError("target source not found.");
  }

  const cacheKey = createPlaybackCacheKey(targetSource, targetId);
  const cachedResource = await readPlaybackCacheEntry(cacheStore, cacheKey);
  const detail = cachedResource ?? await detailFetcher(toEndpoint(source), targetId, {
    ...(fetcher ? { fetcher } : {}),
    ...(timeoutMs === undefined ? {} : { timeoutMs }),
  });

  if (!cachedResource) {
    await savePlaybackCacheEntry(cacheStore, cacheKey, detail);
  }

  const clampedPlayEpisodes = detail.episodes.length > 0
    ? Math.min(Math.max(playEpisodes, 1), detail.episodes.length)
    : playEpisodes;

  const progress = await migratePlaybackProgressRecord(
    {
      id: targetId,
      play_episodes: clampedPlayEpisodes,
      play_time: playTime,
      source: targetSource,
      total_time: totalTime,
    },
    {
      detail,
      ...(detailFetcher !== getVideoSourceDetail ? { detailFetcher } : {}),
      ...(fetcher ? { fetcher } : {}),
      ...(progressStore ? { store: progressStore } : {}),
      ...(timeoutMs === undefined ? {} : { timeoutMs }),
      previousProgress: currentSource !== targetSource || currentId !== targetId ? { id: currentId, source: currentSource } : null,
      userId,
      videoSourceStore,
    },
  );

  if (currentSource !== targetSource || currentId !== targetId) {
    try {
      await migrateFavoriteRecord(
        {
          current: { id: currentId, source: currentSource },
          target: { id: targetId, source: targetSource },
        },
        {
          detail,
          ...(detailFetcher !== getVideoSourceDetail ? { detailFetcher } : {}),
          ...(favoriteStore ? { store: favoriteStore } : {}),
          ...(fetcher ? { fetcher } : {}),
          ...(timeoutMs === undefined ? {} : { timeoutMs }),
          userId,
          videoSourceStore,
        },
      );
    } catch {
      // Source switching and progress migration should still succeed if favorite migration is unavailable.
    }
  }

  return {
    episodes: createPlaybackEpisodes(detail.episodes, detail.episodeTitles ?? []),
    progress: {
      id: progress.id,
      play_episodes: progress.play_episodes,
      play_time: progress.play_time,
      source: progress.source,
      total_time: progress.total_time,
    },
    source_name: detail.sourceName,
    sources: createPlaybackSources(detail.episodes, detail.episodeTitles ?? []),
  };
}
