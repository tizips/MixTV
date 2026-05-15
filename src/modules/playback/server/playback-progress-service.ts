import { getVideoSourceDetail, type VideoSourceAdapterOptions, type VideoSourceEndpoint } from "@/integrations/video-sources";
import { createDbAdapter } from "@/infrastructure/db/db-adapter";
import {
  createVideoSourceStore,
  getVideoSources,
  type VideoSourceStore,
} from "@/modules/admin/server/video-source-service";
import type { DbPort } from "@/shared/db/db-port";

export interface StoredPlaybackProgressRecord {
  cover: string;
  douban_id: number;
  index: number;
  original_episodes: number;
  play_time: number;
  remarks: string;
  save_time: number;
  search_title: string;
  source_name: string;
  title: string;
  total_episodes: number;
  total_time: number;
  year: string;
}

export type PlaybackProgressRecord = StoredPlaybackProgressRecord & {
  id: string;
  source: string;
};

export interface SavePlaybackProgressInput {
  id: string;
  index: number;
  play_time: number;
  source: string;
  total_time: number;
}

export interface PlaybackProgressOptions {
  detailFetcher?: (
    source: VideoSourceEndpoint,
    id: string,
    options: Pick<VideoSourceAdapterOptions, "fetcher" | "timeoutMs">,
  ) => ReturnType<typeof getVideoSourceDetail>;
  fetcher?: VideoSourceAdapterOptions["fetcher"];
  now?: () => number;
  store?: PlaybackProgressStore;
  timeoutMs?: number;
  userId: string;
  videoSourceStore?: VideoSourceStore;
}

export interface InitialPlaybackProgressInput {
  detail: Awaited<ReturnType<typeof getVideoSourceDetail>>;
  id: string;
  source: string;
}

export interface InitialPlaybackProgressOptions {
  now?: () => number;
  store?: PlaybackProgressStore;
  userId: string;
}

export type PlaybackProgressStore = DbPort<unknown, string>;

export class PlaybackProgressValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlaybackProgressValidationError";
  }
}

const playbackProgressNamespace = "user";
const progressFieldDelimiter = ":";

const readProgressScript = `
return redis.call("HGET", KEYS[1], ARGV[1])
`;

const saveProgressScript = `
redis.call("HSET", KEYS[1], ARGV[1], ARGV[2])
return ARGV[2]
`;

export function createPlaybackProgressStore(): PlaybackProgressStore {
  return createDbAdapter<unknown>({ namespace: playbackProgressNamespace });
}

export function createPlaybackProgressField(source: string, id: string) {
  return `${source.trim()}${progressFieldDelimiter}${id.trim()}`;
}

function createUserPlaybackProgressHashKey(userId: string) {
  return `${userId}:pr`;
}

function readRequiredString(value: unknown, name: string) {
  if (typeof value !== "string") {
    throw new PlaybackProgressValidationError(`${name} is required.`);
  }

  const text = value.trim();

  if (!text) {
    throw new PlaybackProgressValidationError(`${name} is required.`);
  }

  return text;
}

function readFiniteNonNegativeNumber(value: unknown, name: string) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new PlaybackProgressValidationError(`${name} must be non-negative.`);
  }

  return Math.floor(value);
}

function readPositiveInteger(value: unknown, name: string) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 1) {
    throw new PlaybackProgressValidationError(`${name} must be a positive integer.`);
  }

  return Math.floor(value);
}

function normalizeSaveInput(input: SavePlaybackProgressInput) {
  return {
    id: readRequiredString(input.id, "id"),
    index: readPositiveInteger(input.index, "index"),
    play_time: readFiniteNonNegativeNumber(input.play_time, "play_time"),
    source: readRequiredString(input.source, "source"),
    total_time: readFiniteNonNegativeNumber(input.total_time, "total_time"),
  };
}

function createRemarks(detail: Awaited<ReturnType<typeof getVideoSourceDetail>>, episodeCount: number) {
  return detail.remarks || (episodeCount > 0 ? `更新至${episodeCount}集` : "");
}

function createStoredPlaybackProgressRecord({
  detail,
  index,
  now,
  playTime,
  totalTime,
}: {
  detail: Awaited<ReturnType<typeof getVideoSourceDetail>>;
  index: number;
  now: number;
  playTime: number;
  totalTime: number;
}): StoredPlaybackProgressRecord {
  const episodeCount = detail.episodes.length;
  const clampedIndex = episodeCount > 0 ? Math.min(Math.max(index, 1), episodeCount) : index;

  return {
    cover: detail.posterUrl,
    douban_id: 0,
    index: clampedIndex,
    original_episodes: episodeCount,
    play_time: playTime,
    remarks: createRemarks(detail, episodeCount),
    save_time: now,
    search_title: "",
    source_name: detail.sourceName,
    title: detail.title,
    total_episodes: episodeCount,
    total_time: totalTime,
    year: detail.year,
  };
}

function parseStoredPlaybackProgress(rawProgress: unknown): StoredPlaybackProgressRecord | null {
  if (typeof rawProgress !== "string") {
    return null;
  }

  try {
    const parsed = JSON.parse(rawProgress) as unknown;

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }

    const progress = parsed as Partial<StoredPlaybackProgressRecord>;

    if (
      typeof progress.cover !== "string" ||
      typeof progress.douban_id !== "number" ||
      typeof progress.index !== "number" ||
      typeof progress.original_episodes !== "number" ||
      typeof progress.play_time !== "number" ||
      typeof progress.remarks !== "string" ||
      typeof progress.save_time !== "number" ||
      typeof progress.search_title !== "string" ||
      typeof progress.source_name !== "string" ||
      typeof progress.title !== "string" ||
      typeof progress.total_episodes !== "number" ||
      typeof progress.total_time !== "number" ||
      typeof progress.year !== "string"
    ) {
      return null;
    }

    return progress as StoredPlaybackProgressRecord;
  } catch {
    return null;
  }
}

async function findSource(sourceKey: string, videoSourceStore: VideoSourceStore) {
  const collection = await getVideoSources(videoSourceStore);
  const source = collection.sources.find((item) => item.key === sourceKey && item.status === "enabled");

  if (!source) {
    throw new PlaybackProgressValidationError("source not found.");
  }

  return {
    apiUrl: source.apiUrl,
    key: source.key,
    name: source.name,
  };
}

async function readStoredProgress({
  field,
  store,
  userId,
}: {
  field: string;
  store: PlaybackProgressStore;
  userId: string;
}) {
  return parseStoredPlaybackProgress(
    await store.script(readProgressScript, {
      args: [field],
      keys: [createUserPlaybackProgressHashKey(userId)],
      readOnly: true,
    }),
  );
}

async function saveStoredProgress({
  field,
  record,
  store,
  userId,
}: {
  field: string;
  record: StoredPlaybackProgressRecord;
  store: PlaybackProgressStore;
  userId: string;
}) {
  await store.script(saveProgressScript, {
    args: [field, JSON.stringify(record)],
    keys: [createUserPlaybackProgressHashKey(userId)],
  });
}

export async function savePlaybackProgress(input: SavePlaybackProgressInput, options: PlaybackProgressOptions) {
  const normalizedInput = normalizeSaveInput(input);
  const store = options.store ?? createPlaybackProgressStore();
  const videoSourceStore = options.videoSourceStore ?? createVideoSourceStore();
  const source = await findSource(normalizedInput.source, videoSourceStore);
  const detail = await (options.detailFetcher ?? getVideoSourceDetail)(source, normalizedInput.id, {
    ...(options.fetcher ? { fetcher: options.fetcher } : {}),
    ...(options.timeoutMs === undefined ? {} : { timeoutMs: options.timeoutMs }),
  });
  const field = createPlaybackProgressField(normalizedInput.source, normalizedInput.id);
  const record = createStoredPlaybackProgressRecord({
    detail,
    index: normalizedInput.index,
    now: options.now?.() ?? Date.now(),
    playTime: normalizedInput.play_time,
    totalTime: normalizedInput.total_time,
  });

  await saveStoredProgress({ field, record, store, userId: options.userId });

  return {
    id: normalizedInput.id,
    source: normalizedInput.source,
    ...record,
  };
}

export async function getOrCreateInitialPlaybackProgress(
  input: InitialPlaybackProgressInput,
  options: InitialPlaybackProgressOptions,
) {
  const source = readRequiredString(input.source, "source");
  const id = readRequiredString(input.id, "id");
  const store = options.store ?? createPlaybackProgressStore();
  const field = createPlaybackProgressField(source, id);
  const existing = await readStoredProgress({ field, store, userId: options.userId });

  if (existing) {
    return {
      id,
      source,
      ...existing,
    };
  }

  const record = createStoredPlaybackProgressRecord({
    detail: input.detail,
    index: 1,
    now: options.now?.() ?? Date.now(),
    playTime: 0,
    totalTime: 0,
  });

  await saveStoredProgress({ field, record, store, userId: options.userId });

  return {
    id,
    source,
    ...record,
  };
}
