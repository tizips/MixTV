import { getVideoSourceDetail, searchVideoSource, type VideoSourceAdapterOptions, type VideoSourceEndpoint } from "@/integrations/video-sources";
import { deleteEdgeOneKvEntry } from "@/infrastructure/db/edgeone-kv-db-adapter";
import { getSiteConfig, type SiteConfigStore } from "@/modules/admin/server/site-config-service";
import {
  createVideoSourceStore,
  getVideoSources,
  type VideoSourceStore,
} from "@/modules/admin/server/video-source-service";
import {
  deleteMediaSearchCacheEntry,
  readMediaSearchCacheEntries,
  saveMediaSearchCacheEntries,
  type MediaSearchCacheStore,
} from "@/modules/search/server/media-search-cache-service";
import {
  createPlaybackCacheKey,
  createPlaybackCacheStore,
  createPlaybackSourcesCacheKey,
  readPlaybackCacheEntry,
  readPlaybackSourcesCacheEntry,
  savePlaybackCacheEntry,
  savePlaybackSourcesCacheEntry,
  type PlaybackCacheStore,
} from "./playback-cache";

export interface PlaybackSourceItem {
  id: string;
  key: string;
  name: string;
  quality?: string;
  source_name: string;
  total_episodes: number;
}

export interface PlaybackSourcesInput {
  index: string;
}

export interface PlaybackSourcesOptions {
  cacheStore?: PlaybackCacheStore;
  detailFetcher?: typeof getVideoSourceDetail;
  fetcher?: VideoSourceAdapterOptions["fetcher"];
  indexCacheStore?: MediaSearchCacheStore;
  maxPages?: number;
  onResult?: (result: PlaybackSourceItem) => void;
  onStart?: (summary: { total: number }) => void;
  searcher?: typeof searchVideoSource;
  siteConfigStore?: SiteConfigStore;
  timeoutMs?: number;
  videoSourceStore?: VideoSourceStore;
}

export interface PlaybackSourcesSummary {
  completed: number;
  total: number;
}

export class PlaybackSourcesValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlaybackSourcesValidationError";
  }
}

const defaultPlaybackSourceLookupConcurrency = 16;

function readIndex(input: PlaybackSourcesInput) {
  const index = input.index.trim();

  if (!index) {
    throw new PlaybackSourcesValidationError("index is required.");
  }

  return index;
}

function readSearchTitle(index: string) {
  const parts = index.trim().split(":");
  return parts.slice(2).join(":").trim() || index.trim();
}

function toEndpoint(source: { apiUrl: string; key: string; name: string }): VideoSourceEndpoint {
  return {
    apiUrl: source.apiUrl,
    key: source.key,
    name: source.name,
  };
}

function toPublicSourceItem(
  sourceName: string,
  resource: Awaited<ReturnType<typeof getVideoSourceDetail>>,
  fallbackId: string,
  fallbackQuality?: string,
): PlaybackSourceItem {
  return {
    id: resource.id || fallbackId,
    key: resource.sourceKey,
    name: resource.sourceName || sourceName,
    quality: resource.quality ?? fallbackQuality,
    source_name: resource.sourceName || sourceName,
    total_episodes: resource.episodes.length,
  };
}

function toIndexCacheEntry(item: PlaybackSourceItem) {
  return [{
    id: item.id,
    quality: item.quality ?? "",
    resourceKey: item.key,
    name: item.name,
    total_episodes: item.total_episodes,
  }];
}

export async function getPlaybackSources(
  input: PlaybackSourcesInput,
  {
    cacheStore = createPlaybackCacheStore(),
    detailFetcher = getVideoSourceDetail,
    fetcher,
    indexCacheStore,
    maxPages,
    onResult,
    onStart,
    searcher = searchVideoSource,
    siteConfigStore,
    timeoutMs,
    videoSourceStore = createVideoSourceStore(),
  }: PlaybackSourcesOptions = {},
): Promise<PlaybackSourcesSummary> {
  const index = readIndex(input);
  const searchTitle = readSearchTitle(index);
  const playbackSourcesCacheKey = createPlaybackSourcesCacheKey(index);
  const cachedSources = await readPlaybackSourcesCacheEntry(cacheStore, playbackSourcesCacheKey);

  if (cachedSources) {
    onStart?.({ total: cachedSources.length });

    for (const source of cachedSources) {
      onResult?.(source);
    }

    return {
      completed: cachedSources.length,
      total: cachedSources.length,
    };
  }

  const [siteConfig, collection, cachedEntries] = await Promise.all([
    getSiteConfig(siteConfigStore),
    getVideoSources(videoSourceStore),
    readMediaSearchCacheEntries(index, { store: indexCacheStore }),
  ]);
  const sources = collection.sources.filter((source) => {
    if (source.status !== "enabled") {
      return false;
    }

    return siteConfig.showAdultContent || !source.adult;
  });

  const cachedByKey = new Map(cachedEntries.map((entry) => [entry.resourceKey, entry]));
  const cachedPlayableSources = sources
    .map((source) => cachedByKey.get(source.key))
    .filter((entry): entry is NonNullable<typeof entry> => entry !== undefined);

  if (cachedPlayableSources.length > 0 && cachedPlayableSources.every((entry) => entry.total_episodes > 0)) {
    onStart?.({ total: cachedPlayableSources.length });

    for (const entry of cachedPlayableSources) {
      onResult?.({
        id: entry.id,
        key: entry.resourceKey,
        name: entry.name,
        quality: entry.quality || undefined,
        source_name: entry.name,
        total_episodes: entry.total_episodes,
      });
    }

    return {
      completed: cachedPlayableSources.length,
      total: cachedPlayableSources.length,
    };
  }

  onStart?.({ total: sources.length });

  let completed = 0;
  const cachedResultsBySourceIndex = new Map<number, PlaybackSourceItem>();
  let nextSourceIndex = 0;
  let cacheWriteQueue = Promise.resolve();
  const enqueueCacheWrite = async (operation: () => Promise<void>) => {
    const result = cacheWriteQueue.then(operation, operation);
    cacheWriteQueue = result.then(() => undefined, () => undefined);
    await result;
  };
  const lookupNextSource = async () => {
    while (nextSourceIndex < sources.length) {
      const sourceIndex = nextSourceIndex;
      const source = sources[sourceIndex];
      nextSourceIndex += 1;

      if (!source) {
        return;
      }

      const cachedEntry = cachedByKey.get(source.key);
      const cacheKey = cachedEntry ? createPlaybackCacheKey(source.key, cachedEntry.id) : "";
      let detail = cachedEntry
        ? await readPlaybackCacheEntry(cacheStore, cacheKey)
        : null;

      if (!detail) {
        try {
          if (!cachedEntry) {
            const results = await searcher(toEndpoint(source), searchTitle, {
              ...(fetcher ? { fetcher } : {}),
              ...(maxPages === undefined ? {} : { maxPages }),
              ...(timeoutMs === undefined ? {} : { timeoutMs }),
            });

            const firstMatch = results[0];

            if (!firstMatch) {
              await enqueueCacheWrite(() => deleteMediaSearchCacheEntry(index, source.key, { store: indexCacheStore }));
              continue;
            }

            const item = toPublicSourceItem(source.name, firstMatch, firstMatch.id, firstMatch.quality);

            try {
              await enqueueCacheWrite(() => saveMediaSearchCacheEntries(index, toIndexCacheEntry(item), { store: indexCacheStore }));
            } catch {
              // Cache writes must not block playback source resolution.
            }
            detail = await detailFetcher(toEndpoint(source), item.id, {
              ...(fetcher ? { fetcher } : {}),
              ...(timeoutMs === undefined ? {} : { timeoutMs }),
            });
          } else {
            detail = await detailFetcher(toEndpoint(source), cachedEntry.id, {
              ...(fetcher ? { fetcher } : {}),
              ...(timeoutMs === undefined ? {} : { timeoutMs }),
            });
          }

          const resolvedDetail = detail;

          if (!resolvedDetail) {
            continue;
          }

          if (!resolvedDetail.episodes.length) {
            await enqueueCacheWrite(async () => {
              if (cacheKey) {
                await deleteEdgeOneKvEntry(cacheStore, cacheKey);
              }
              await deleteMediaSearchCacheEntry(index, source.key, { store: indexCacheStore });
            });
            continue;
          }

          await enqueueCacheWrite(() => savePlaybackCacheEntry(cacheStore, createPlaybackCacheKey(source.key, resolvedDetail.id), resolvedDetail));
        } catch {
          await enqueueCacheWrite(async () => {
            if (cacheKey) {
              await deleteEdgeOneKvEntry(cacheStore, cacheKey);
            }
            await deleteMediaSearchCacheEntry(index, source.key, { store: indexCacheStore });
          });
          continue;
        }
      }

      if (!detail) {
        continue;
      }

      const result = toPublicSourceItem(source.name, detail, cachedEntry?.id ?? detail.id, cachedEntry?.quality);
      onResult?.(result);
      cachedResultsBySourceIndex.set(sourceIndex, result);
      completed += 1;
    }
  };

  await Promise.all(
    Array.from(
      { length: Math.min(defaultPlaybackSourceLookupConcurrency, sources.length) },
      () => lookupNextSource(),
    ),
  );

  const cachedResults = [...cachedResultsBySourceIndex.entries()]
    .sort(([leftIndex], [rightIndex]) => leftIndex - rightIndex)
    .map(([, result]) => result);

  await savePlaybackSourcesCacheEntry(cacheStore, playbackSourcesCacheKey, cachedResults);

  return {
    completed,
    total: sources.length,
  };
}
