import { getVideoSourceDetail, searchVideoSource, type VideoSourceAdapterOptions, type VideoSourceEndpoint } from "@/integrations/video-sources";
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
import { createMediaSearchIndex } from "@/shared/media/search-index";
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

const playbackSourceLookupConcurrency = 3;

export interface PlaybackSourceItem {
  id: string;
  key: string;
  name: string;
  probe_url: string;
  quality?: string;
  source_name: string;
  total_episodes: number;
}

export interface PlaybackSourcesInput {
  index: string;
  keyword: string;
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

function readIndex(input: PlaybackSourcesInput) {
  const index = input.index.trim();

  if (!index) {
    throw new PlaybackSourcesValidationError("index is required.");
  }

  return index;
}

function readKeyword(input: PlaybackSourcesInput) {
  const keyword = input.keyword.trim();

  if (!keyword) {
    throw new PlaybackSourcesValidationError("keyword is required.");
  }

  return keyword;
}

function createResourceIndex(resource: Awaited<ReturnType<typeof getVideoSourceDetail>>) {
  return createMediaSearchIndex({
    className: resource.className,
    title: resource.title,
    typeName: resource.typeName,
    year: resource.year,
  });
}

function findIndexedSearchResult(
  results: Awaited<ReturnType<typeof searchVideoSource>>,
  index: string,
) {
  return results.find((result) => createResourceIndex(result) === index) ?? null;
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
  probeUrl: string,
  resource: Awaited<ReturnType<typeof getVideoSourceDetail>>,
  fallbackId: string,
  fallbackQuality?: string,
): PlaybackSourceItem {
  return {
    id: resource.id || fallbackId,
    key: resource.sourceKey,
    name: resource.sourceName || sourceName,
    probe_url: probeUrl,
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
  const keyword = readKeyword(input);
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
    .map((source) => {
      const entry = cachedByKey.get(source.key);
      return entry ? { entry, source } : null;
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  if (cachedPlayableSources.length > 0 && cachedPlayableSources.every(({ entry }) => entry.total_episodes > 0)) {
    onStart?.({ total: cachedPlayableSources.length });

    for (const { entry, source } of cachedPlayableSources) {
      onResult?.({
        id: entry.id,
        key: entry.resourceKey,
        name: entry.name,
        probe_url: source.apiUrl,
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

  const resolveSource = async (source: (typeof sources)[number]) => {
    if (!source) {
      return null;
    }

    const cachedEntry = cachedByKey.get(source.key);
    const cacheKey = cachedEntry ? createPlaybackCacheKey(source.key, cachedEntry.id) : "";
    let fallbackId = cachedEntry?.id;
    let fallbackQuality = cachedEntry?.quality;
    let detail = cachedEntry
      ? await readPlaybackCacheEntry(cacheStore, cacheKey)
      : null;

    if (!detail) {
      try {
        if (!cachedEntry) {
          const results = await searcher(toEndpoint(source), keyword, {
            ...(fetcher ? { fetcher } : {}),
            ...(maxPages === undefined ? {} : { maxPages }),
            ...(timeoutMs === undefined ? {} : { timeoutMs }),
          });

          const firstMatch = findIndexedSearchResult(results, index);

          if (!firstMatch) {
            await deleteMediaSearchCacheEntry(index, source.key, { store: indexCacheStore });
            return null;
          }

          fallbackId = firstMatch.id;
          fallbackQuality = firstMatch.quality;
          detail = await detailFetcher(toEndpoint(source), firstMatch.id, {
            ...(fetcher ? { fetcher } : {}),
            ...(timeoutMs === undefined ? {} : { timeoutMs }),
          });
        } else {
          detail = await detailFetcher(toEndpoint(source), cachedEntry.id, {
            ...(fetcher ? { fetcher } : {}),
            ...(timeoutMs === undefined ? {} : { timeoutMs }),
          });
        }

        if (!detail.episodes.length) {
          if (cacheKey) {
            await cacheStore.del(cacheKey);
          }
          await deleteMediaSearchCacheEntry(index, source.key, { store: indexCacheStore });
          return null;
        }

        await savePlaybackCacheEntry(cacheStore, createPlaybackCacheKey(source.key, detail.id), detail);
      } catch {
        if (cacheKey) {
          await cacheStore.del(cacheKey);
        }
        await deleteMediaSearchCacheEntry(index, source.key, { store: indexCacheStore });
        return null;
      }
    }

    const result = toPublicSourceItem(
      source.name,
      source.apiUrl,
      detail,
      fallbackId ?? detail.id,
      fallbackQuality,
    );
    try {
      await saveMediaSearchCacheEntries(index, toIndexCacheEntry(result), { store: indexCacheStore });
    } catch {
      // Cache writes must not block playback source resolution.
    }

    return result;
  };

  let completed = 0;
  let nextSourceIndex = 0;
  const cachedResults: Array<PlaybackSourceItem | null> = new Array(sources.length).fill(null);
  const runSourceWorker = async () => {
    while (nextSourceIndex < sources.length) {
      const sourceIndex = nextSourceIndex;
      nextSourceIndex += 1;
      const result = await resolveSource(sources[sourceIndex]);

      if (!result) {
        continue;
      }

      cachedResults[sourceIndex] = result;
      completed += 1;
      onResult?.(result);
    }
  };

  await Promise.all(
    Array.from(
      { length: Math.min(playbackSourceLookupConcurrency, sources.length) },
      () => runSourceWorker(),
    ),
  );

  const resolvedResults = cachedResults.filter((result): result is PlaybackSourceItem => result !== null);

  await savePlaybackSourcesCacheEntry(cacheStore, playbackSourcesCacheKey, resolvedResults);

  return {
    completed,
    total: sources.length,
  };
}
