import { searchVideoSource, type VideoSourceAdapterOptions, type VideoSourceEndpoint, type VideoSourceResource } from "@/integrations/video-sources";
import { getSiteConfig, type SiteConfigStore } from "@/modules/admin/server/site-config-service";
import {
  createVideoSourceStore,
  getVideoSources,
  type VideoSourceItem,
  type VideoSourceStore,
} from "@/modules/admin/server/video-source-service";

export interface MediaSearchInput {
  query: string;
}

export interface MediaSearchSourceResult {
  results: MediaSearchResult[];
  source: VideoSourceItem;
}

export interface MediaSearchResult {
  cover: string;
  id: string;
  idx: string;
  key: string;
  source_name: string;
  quality?: string;
  source_total: number;
  title: string;
  total_episodes: number;
  year: string;
}

export interface MediaSearchSummary {
  completed: number;
  total: number;
}

type AggregatedMediaSearchResult = MediaSearchResult & {
  sourceKeys: Set<string>;
};

export interface MediaSearchOptions {
  fetcher?: VideoSourceAdapterOptions["fetcher"];
  maxPages?: number;
  onResult?: (result: MediaSearchSourceResult) => void;
  onStart?: (summary: { total: number }) => void;
  searcher?: (
    source: VideoSourceEndpoint,
    query: string,
    options: VideoSourceAdapterOptions,
  ) => Promise<VideoSourceResource[]>;
  siteConfigStore?: SiteConfigStore;
  timeoutMs?: number;
  videoSourceStore?: VideoSourceStore;
}

export class MediaSearchValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MediaSearchValidationError";
  }
}

function readQuery(input: MediaSearchInput) {
  const query = input.query.trim();

  if (!query) {
    throw new MediaSearchValidationError("q is required.");
  }

  return query;
}

function toSearchEndpoint(source: VideoSourceItem): VideoSourceEndpoint {
  return {
    apiUrl: source.apiUrl,
    key: source.key,
    name: source.name,
  };
}

function normalizeTitle(title: string) {
  return title
    .trim()
    .toLowerCase()
    .replace(/[：:]/g, " ")
    .replace(/\s+/g, "")
    .replace(/第(一|二|三|四|五|六|七|八|九|十|\d+)(季|部)$/g, "");
}

function createAggregationKey(resource: VideoSourceResource) {
  if (resource.doubanId) {
    return `douban:${resource.doubanId}`;
  }

  const title = normalizeTitle(resource.title);
  const year = resource.year.trim();
  const typeName = resource.typeName?.trim() || resource.className?.trim();

  if (title && year && year !== "unknown") {
    return `title:${title}:year:${year}`;
  }

  if (title && typeName) {
    return `title:${title}:type:${typeName}`;
  }

  return `source:${resource.sourceKey}:${resource.id}`;
}

function createMediaSearchResult(id: string, resource: VideoSourceResource): MediaSearchResult {
  return {
    total_episodes: resource.episodes.length,
    id: resource.id,
    idx: id,
    key: resource.sourceKey,
    cover: resource.posterUrl,
    source_name: resource.sourceName,
    quality: resource.quality,
    source_total: 1,
    title: resource.title,
    year: resource.year,
  };
}

function mergeMediaSearchResult(
  current: AggregatedMediaSearchResult,
  resource: VideoSourceResource,
): AggregatedMediaSearchResult {
  return {
    ...current,
    total_episodes: Math.max(current.total_episodes, resource.episodes.length),
    cover: current.cover || resource.posterUrl,
    quality: current.quality || resource.quality,
    source_total: current.source_total + (current.key === resource.sourceKey ? 0 : 1),
  };
}

export async function searchMediaSources(
  input: MediaSearchInput,
  {
    fetcher,
    maxPages,
    onResult,
    onStart,
    searcher = searchVideoSource,
    siteConfigStore,
    timeoutMs,
    videoSourceStore = createVideoSourceStore(),
  }: MediaSearchOptions = {},
): Promise<MediaSearchSummary> {
  const query = readQuery(input);
  const [siteConfig, collection] = await Promise.all([
    getSiteConfig(siteConfigStore),
    getVideoSources(videoSourceStore),
  ]);
  const sources = collection.sources.filter((source) => {
    if (source.status !== "enabled") {
      return false;
    }

    return siteConfig.showAdultContent || !source.adult;
  });

  onStart?.({ total: sources.length });

  let completed = 0;
  const aggregatedByKey = new Map<string, AggregatedMediaSearchResult>();

  for (const source of sources) {
    const changedResults: MediaSearchResult[] = [];

    try {
      const results = await searcher(toSearchEndpoint(source), query, {
        ...(fetcher ? { fetcher } : {}),
        ...(maxPages === undefined ? {} : { maxPages }),
        ...(timeoutMs === undefined ? {} : { timeoutMs }),
      });

      for (const result of results) {
        const key = createAggregationKey(result);
        const current = aggregatedByKey.get(key);
        const aggregated = current
          ? mergeMediaSearchResult(current, result)
          : { ...createMediaSearchResult(key, result), sourceKeys: new Set([result.sourceKey]) };

        aggregated.sourceKeys.add(result.sourceKey);
        aggregated.source_total = aggregated.sourceKeys.size;

        aggregatedByKey.set(key, aggregated);
        const { sourceKeys, ...publicResult } = aggregated;
        changedResults.push(publicResult);
      }
    } catch {
      // One slow or broken third-party source should not fail the full aggregate search.
    }

    completed += 1;
    onResult?.({ results: changedResults, source });
  }

  return {
    completed,
    total: sources.length,
  };
}
