import { getVideoSourceDetail, type VideoSourceAdapterOptions, type VideoSourceEndpoint } from "@/integrations/video-sources";
import { createDbAdapter } from "@/infrastructure/db/db-adapter";
import {
  createVideoSourceStore,
  getVideoSources,
  type VideoSourceStore,
} from "@/modules/admin/server/video-source-service";
import type { DbPort } from "@/shared/db/db-port";
import { createMediaSearchIndex } from "@/shared/media/search-index";

export interface StoredPlaybackProgressRecord {
  cover: string;
  douban_id: number;
  index?: string;
  original_episodes: number;
  play_time: number;
  play_episodes: number;
  remarks: string;
  save_time: number;
  search_title: string;
  source_name: string;
  title: string;
  total_time: number;
  year: string;
}

export type PlaybackProgressRecord = StoredPlaybackProgressRecord & {
  id: string;
  source: string;
};

export interface SavePlaybackProgressInput {
  id: string;
  play_episodes: number;
  play_time: number;
  source: string;
  total_time: number;
}

export interface PlaybackProgressOptions {
  detail?: Awaited<ReturnType<typeof getVideoSourceDetail>>;
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

const readAllProgressScript = `
return redis.call("HGETALL", KEYS[1])
`;

const saveProgressScript = `
redis.call("HSET", KEYS[1], ARGV[1], ARGV[2])
return ARGV[2]
`;

const deleteProgressScript = `
redis.call("HDEL", KEYS[1], ARGV[1])
return 1
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

function toHashRecord(value: unknown) {
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
    play_episodes: readPositiveInteger(input.play_episodes, "play_episodes"),
    play_time: readFiniteNonNegativeNumber(input.play_time, "play_time"),
    source: readRequiredString(input.source, "source"),
    total_time: readFiniteNonNegativeNumber(input.total_time, "total_time"),
  };
}

function createRemarks(detail: Awaited<ReturnType<typeof getVideoSourceDetail>>, episodeCount: number) {
  return detail.remarks || (episodeCount > 0 ? `更新至${episodeCount}集` : "");
}

function createPlaybackProgressIndex(detail: Awaited<ReturnType<typeof getVideoSourceDetail>>) {
  return createMediaSearchIndex({
    className: detail.className,
    title: detail.title,
    typeName: detail.typeName,
    year: detail.year,
  });
}

function createStoredPlaybackProgressRecord({
  detail,
  playEpisodes,
  now,
  playTime,
  totalTime,
}: {
  detail: Awaited<ReturnType<typeof getVideoSourceDetail>>;
  playEpisodes: number;
  now: number;
  playTime: number;
  totalTime: number;
}): StoredPlaybackProgressRecord {
  const episodeCount = detail.episodes.length;
  const clampedIndex = episodeCount > 0 ? Math.min(Math.max(playEpisodes, 1), episodeCount) : playEpisodes;

  return {
    cover: detail.posterUrl,
    douban_id: 0,
    index: createPlaybackProgressIndex(detail),
    original_episodes: episodeCount,
    play_time: playTime,
    play_episodes: clampedIndex,
    remarks: createRemarks(detail, episodeCount),
    save_time: now,
    search_title: "",
    source_name: detail.sourceName,
    title: detail.title,
    total_time: totalTime,
    year: detail.year,
  };
}

function parseStoredPlaybackProgress(
  rawProgress: unknown,
): { needsMigration: boolean; record: StoredPlaybackProgressRecord | null } {
  if (typeof rawProgress !== "string") {
    return { needsMigration: false, record: null };
  }

  try {
    const parsed = JSON.parse(rawProgress) as unknown;

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { needsMigration: false, record: null };
    }

    const progress = parsed as Partial<StoredPlaybackProgressRecord>;
    const legacyIndex = parsed as Partial<{ index: number }>;
    const storedIndex = parsed as Partial<{ index: string }>;
    const hasPlayEpisodes = typeof progress.play_episodes === "number";
    const playEpisodes = hasPlayEpisodes ? progress.play_episodes : legacyIndex.index;
    const needsMigration = !hasPlayEpisodes && typeof legacyIndex.index === "number";

    if (
      typeof progress.cover !== "string" ||
      typeof progress.douban_id !== "number" ||
      (progress.index !== undefined && typeof progress.index !== "string" && typeof progress.index !== "number") ||
      typeof progress.original_episodes !== "number" ||
      typeof progress.play_time !== "number" ||
      typeof playEpisodes !== "number" ||
      typeof progress.remarks !== "string" ||
      typeof progress.save_time !== "number" ||
      typeof progress.search_title !== "string" ||
      typeof progress.source_name !== "string" ||
      typeof progress.title !== "string" ||
      typeof progress.total_time !== "number" ||
      typeof progress.year !== "string"
    ) {
      return { needsMigration: false, record: null };
    }

    return {
      needsMigration,
      record: {
        ...progress,
        index: typeof storedIndex.index === "string" ? storedIndex.index : undefined,
        play_episodes: playEpisodes,
      } as StoredPlaybackProgressRecord,
    };
  } catch {
    return { needsMigration: false, record: null };
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
  const parsed = parseStoredPlaybackProgress(
    await store.script(readProgressScript, {
      args: [field],
      keys: [createUserPlaybackProgressHashKey(userId)],
      readOnly: true,
    }),
  );

  if (parsed.record && parsed.needsMigration) {
    await saveStoredProgress({ field, record: parsed.record, store, userId });
  }

  return parsed.record;
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

async function readAllStoredProgress(userId: string, store: PlaybackProgressStore) {
  return toHashRecord(
    await store.script(readAllProgressScript, {
      keys: [createUserPlaybackProgressHashKey(userId)],
      readOnly: true,
    }),
  );
}

export async function savePlaybackProgress(input: SavePlaybackProgressInput, options: PlaybackProgressOptions) {
  const normalizedInput = normalizeSaveInput(input);
  const store = options.store ?? createPlaybackProgressStore();
  const videoSourceStore = options.videoSourceStore ?? createVideoSourceStore();
  const source = await findSource(normalizedInput.source, videoSourceStore);
  const detail = options.detail ?? await (options.detailFetcher ?? getVideoSourceDetail)(source, normalizedInput.id, {
    ...(options.fetcher ? { fetcher: options.fetcher } : {}),
    ...(options.timeoutMs === undefined ? {} : { timeoutMs: options.timeoutMs }),
  });
  const field = createPlaybackProgressField(normalizedInput.source, normalizedInput.id);
  const record = createStoredPlaybackProgressRecord({
    detail,
    playEpisodes: normalizedInput.play_episodes,
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
    playEpisodes: 1,
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

export async function findPlaybackProgressByIndex(
  userId: string,
  index: string,
  { store = createPlaybackProgressStore() }: { store?: PlaybackProgressStore } = {},
) {
  const normalizedIndex = readRequiredString(index, "index");
  const records = await readAllStoredProgress(userId, store);
  let found: PlaybackProgressRecord | null = null;

  for (const [field, rawProgress] of Object.entries(records)) {
    const delimiterIndex = field.indexOf(":");

    if (delimiterIndex <= 0 || delimiterIndex === field.length - 1) {
      continue;
    }

    const parsed = parseStoredPlaybackProgress(rawProgress);

    if (!parsed.record || parsed.record.index !== normalizedIndex) {
      continue;
    }

    const currentRecord: PlaybackProgressRecord = {
      id: field.slice(delimiterIndex + 1),
      source: field.slice(0, delimiterIndex),
      ...parsed.record,
    };

    if (!found || currentRecord.save_time >= found.save_time) {
      found = currentRecord;
    }
  }

  return found;
}

export async function deletePlaybackProgress(
  userId: string,
  input: { id: string; source: string },
  { store = createPlaybackProgressStore() }: { store?: PlaybackProgressStore } = {},
) {
  const source = readRequiredString(input.source, "source");
  const id = readRequiredString(input.id, "id");
  const field = createPlaybackProgressField(source, id);

  await store.script(deleteProgressScript, {
    args: [field],
    keys: [createUserPlaybackProgressHashKey(userId)],
  });
}
