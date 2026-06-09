import { getVideoSourceDetail, type VideoSourceAdapterOptions, type VideoSourceEndpoint } from "@/integrations/video-sources";
import {
  getEdgeOneKvBinding,
  listEdgeOneKvLogicalKeys,
  patchEdgeOneKvHash,
  readEdgeOneKvHash,
} from "@/infrastructure/db/edgeone-kv-db-adapter";
import {
  createVideoSourceStore,
  getVideoSources,
  type VideoSourceStore,
} from "@/modules/admin/server/video-source-service";
import { createPlaybackProgressStore } from "@/modules/playback/server/playback-progress-service";
import { type HistoryItem, listPlaybackHistory, updatePlaybackHistoryTotalEpisodes, type HistoryStore } from "./history-service";

export type HistoryUpdateCacheStore = ReturnType<typeof createHistoryUpdateCacheStore>;

export type HistoryUpdateSummary = {
  checked: number;
  errors: number;
  skipped: number;
  updated: number;
  users: number;
};

export type HistoryUpdateCountSummary = {
  history: number;
};

export type HistoryUpdateEvent =
  | { total: number; type: "start" }
  | { id: string; reason: "older_than_30_days"; source: string; type: "skip" }
  | {
      cached: boolean;
      id: string;
      newTotalEpisodes: number;
      oldTotalEpisodes: number;
      source: string;
      type: "unchanged" | "update";
      updated: boolean;
    }
  | { id: string; message: string; source: string; type: "error" }
  | { checked: number; errors: number; skipped: number; updated: number; type: "done" };

export interface HistoryUpdateOptions {
  cacheStore?: HistoryUpdateCacheStore;
  detailFetcher?: (
    source: VideoSourceEndpoint,
    id: string,
    options: Pick<VideoSourceAdapterOptions, "fetcher" | "timeoutMs">,
  ) => ReturnType<typeof getVideoSourceDetail>;
  fetcher?: VideoSourceAdapterOptions["fetcher"];
  historyStore?: HistoryStore;
  now?: () => number;
  timeoutMs?: number;
  videoSourceStore?: VideoSourceStore;
}

export type HistoryUpdateAllOptions = HistoryUpdateOptions;

export class HistoryUpdateValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HistoryUpdateValidationError";
  }
}

const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;
const historyUpdateCacheSeconds = 2 * 60 * 60;
const historyUpdateCacheKvBindingName = "cache";
const historyUpdateCacheKeyPrefix = "cache:update";
const historyUpdateCacheTotalEpisodesField = "original_episodes";
const playbackProgressHashKeySuffix = ":pr";

function normalizeHistoryUpdateTotal(totalEpisodes: number) {
  if (!Number.isFinite(totalEpisodes) || totalEpisodes < 0) {
    throw new HistoryUpdateValidationError("original_episodes must be non-negative.");
  }

  return Math.floor(totalEpisodes);
}

function createHistoryUpdateCacheKey(source: string, id: string) {
  return `${historyUpdateCacheKeyPrefix}:${source}:${id}`;
}

function createPlaybackHistoryHashKeyPattern() {
  return `*${playbackProgressHashKeySuffix}`;
}

function createVideoSourceEndpoint(source: Awaited<ReturnType<typeof getVideoSources>>["sources"][number]): VideoSourceEndpoint {
  return {
    apiUrl: source.apiUrl,
    key: source.key,
    name: source.name,
  };
}

function toHashRecord(value: unknown) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return Object.fromEntries(
      Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
    );
  }

  if (!Array.isArray(value)) {
    return null;
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

function toStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

async function readCachedSourceTotal(cacheStore: HistoryUpdateCacheStore, cacheKey: string) {
  const record = toHashRecord(await readEdgeOneKvHash(cacheStore, cacheKey));

  if (!record) {
    return null;
  }

  const totalEpisodes = Number(record[historyUpdateCacheTotalEpisodesField]);

  if (!Number.isFinite(totalEpisodes) || totalEpisodes < 0) {
    return null;
  }

  return {
    original_episodes: Math.floor(totalEpisodes),
  };
}

async function saveCachedSourceTotal(
  cacheStore: HistoryUpdateCacheStore,
  cacheKey: string,
  totalEpisodes: number,
) {
  await patchEdgeOneKvHash(cacheStore, cacheKey, {
    [historyUpdateCacheTotalEpisodesField]: String(totalEpisodes),
  }, { ttlSeconds: historyUpdateCacheSeconds });
}

async function findEnabledSource(sourceKey: string, videoSourceStore: VideoSourceStore) {
  const collection = await getVideoSources(videoSourceStore);
  const source = collection.sources.find((item) => item.key === sourceKey && item.status === "enabled");

  return source ? createVideoSourceEndpoint(source) : null;
}

function isStaleHistoryItem(item: HistoryItem, currentTime: number) {
  return currentTime - item.save_time > thirtyDaysInMs;
}

function readPlaybackHistoryUserIdFromKey(key: string) {
  if (!key.endsWith(playbackProgressHashKeySuffix)) {
    return "";
  }

  const prefixEnd = key.indexOf(":");

  if (prefixEnd < 0 || prefixEnd >= key.length - playbackProgressHashKeySuffix.length) {
    return "";
  }

  return key.slice(prefixEnd + 1, -playbackProgressHashKeySuffix.length);
}

function createHistoryUpdateEvent(
  item: HistoryItem,
  type: "unchanged" | "update",
  cached: boolean,
  newTotalEpisodes: number,
): HistoryUpdateEvent {
  return {
    cached,
    id: item.id,
    newTotalEpisodes,
    oldTotalEpisodes: item.original_episodes,
    source: item.source,
    type,
    updated: newTotalEpisodes > item.original_episodes,
  };
}

export function createHistoryUpdateCacheStore() {
  return getEdgeOneKvBinding({
    bindingName: historyUpdateCacheKvBindingName,
  });
}

async function listPlaybackHistoryUserIds(store: HistoryStore) {
  const keys = toStringArray(await listEdgeOneKvLogicalKeys(store, {
    limit: 1000,
    pattern: createPlaybackHistoryHashKeyPattern(),
  }));

  return [...new Set(keys.map(readPlaybackHistoryUserIdFromKey).filter((userId) => userId.length > 0))];
}

async function resolveHistoryUpdateTotalEpisodes(
  item: HistoryItem,
  options: Pick<HistoryUpdateOptions, "cacheStore" | "detailFetcher" | "fetcher" | "timeoutMs" | "videoSourceStore">,
) {
  const {
    cacheStore = createHistoryUpdateCacheStore(),
    detailFetcher = getVideoSourceDetail,
    fetcher,
    timeoutMs,
    videoSourceStore = createVideoSourceStore(),
  } = options;
  const cacheKey = createHistoryUpdateCacheKey(item.source, item.id);
  const cached = await readCachedSourceTotal(cacheStore, cacheKey);
  const isCached = typeof cached?.original_episodes === "number";
  let resolvedTotalEpisodes = cached?.original_episodes;

  if (typeof resolvedTotalEpisodes !== "number") {
    const source = await findEnabledSource(item.source, videoSourceStore);

    if (!source) {
      throw new HistoryUpdateValidationError("source not found.");
    }

    const detail = await detailFetcher(source, item.id, {
      ...(fetcher ? { fetcher } : {}),
      ...(timeoutMs === undefined ? {} : { timeoutMs }),
    });

    resolvedTotalEpisodes = detail.episodes.length;
    await saveCachedSourceTotal(cacheStore, cacheKey, resolvedTotalEpisodes);
  }

  return {
    cached: isCached,
    totalEpisodes: normalizeHistoryUpdateTotal(resolvedTotalEpisodes),
  };
}

export async function* checkHistoryUpdates(userId: string, options: HistoryUpdateOptions = {}): AsyncGenerator<HistoryUpdateEvent> {
  const {
    historyStore,
    now = Date.now,
  } = options;
  const history = await listPlaybackHistory(userId, { store: historyStore });
  const currentTime = now();
  let checked = 0;
  let skipped = 0;
  let updated = 0;
  let errors = 0;

  yield { total: history.length, type: "start" };

  for (const item of history) {
    if (isStaleHistoryItem(item, currentTime)) {
      skipped += 1;
      yield { id: item.id, reason: "older_than_30_days", source: item.source, type: "skip" };
      continue;
    }

    checked += 1;

    try {
      const { cached, totalEpisodes: normalizedTotalEpisodes } = await resolveHistoryUpdateTotalEpisodes(item, options);

      if (normalizedTotalEpisodes > item.original_episodes) {
        await updatePlaybackHistoryTotalEpisodes(userId, item, normalizedTotalEpisodes, { store: historyStore });
        updated += 1;
        yield createHistoryUpdateEvent(item, "update", cached, normalizedTotalEpisodes);
      } else {
        yield createHistoryUpdateEvent(item, "unchanged", cached, normalizedTotalEpisodes);
      }
    } catch (error) {
      errors += 1;
      yield {
        id: item.id,
        message: error instanceof Error ? error.message : "History update check failed.",
        source: item.source,
        type: "error",
      };
    }
  }

  yield { checked, errors, skipped, type: "done", updated };
}

export async function countHistoryUpdates(userId: string, options: HistoryUpdateOptions = {}): Promise<HistoryUpdateCountSummary> {
  const { historyStore } = options;
  const history = await listPlaybackHistory(userId, { store: historyStore });
  const historyCount = history.filter((item) => item.original_episodes > item.play_episodes).length;

  return { history: historyCount };
}

async function checkHistoryUpdatesForUser(userId: string, options: HistoryUpdateOptions) {
  let checked = 0;
  let errors = 0;
  let skipped = 0;
  let updated = 0;

  for await (const event of checkHistoryUpdates(userId, options)) {
    if (event.type !== "done") {
      continue;
    }

    checked += event.checked;
    errors += event.errors;
    skipped += event.skipped;
    updated += event.updated;
  }

  return { checked, errors, skipped, updated };
}

export async function checkAllHistoryUpdates(options: HistoryUpdateAllOptions = {}): Promise<HistoryUpdateSummary> {
  const historyStore = options.historyStore ?? createPlaybackProgressStore();
  const userIds = await listPlaybackHistoryUserIds(historyStore);
  const summary: HistoryUpdateSummary = {
    checked: 0,
    errors: 0,
    skipped: 0,
    updated: 0,
    users: 0,
  };

  for (const userId of userIds) {
    summary.users += 1;
    const result = await checkHistoryUpdatesForUser(userId, {
      ...options,
      historyStore,
    });

    summary.checked += result.checked;
    summary.errors += result.errors;
    summary.skipped += result.skipped;
    summary.updated += result.updated;
  }

  return summary;
}
