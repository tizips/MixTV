import { getVideoSourceDetail, type VideoSourceAdapterOptions, type VideoSourceEndpoint } from "@/integrations/video-sources";
import { createDbAdapter } from "@/infrastructure/db/db-adapter";
import {
  createVideoSourceStore,
  getVideoSources,
  type VideoSourceStore,
} from "@/modules/admin/server/video-source-service";
import type { DbPort } from "@/shared/db/db-port";
import { createMediaSearchIndex } from "@/shared/media/search-index";

export interface StoredFavoriteRecord {
  cover: string;
  douban_id: number;
  original_episodes: number;
  index?: string;
  remarks: string;
  save_time: number;
  search_title: string;
  source_name: string;
  title: string;
  year: string;
}

export type FavoriteItem = StoredFavoriteRecord & {
  id: string;
  source: string;
};

export interface FavoriteServiceOptions {
  detailFetcher?: (
    source: VideoSourceEndpoint,
    id: string,
    options: Pick<VideoSourceAdapterOptions, "fetcher" | "timeoutMs">,
  ) => ReturnType<typeof getVideoSourceDetail>;
  fetcher?: VideoSourceAdapterOptions["fetcher"];
  now?: () => number;
  store?: FavoriteStore;
  timeoutMs?: number;
  userId: string;
  videoSourceStore?: VideoSourceStore;
}

export interface MigrateFavoriteInput {
  current: {
    id: string;
    source: string;
  };
  target: {
    id: string;
    source: string;
  };
}

export interface MigrateFavoriteOptions extends FavoriteServiceOptions {
  detail?: Awaited<ReturnType<typeof getVideoSourceDetail>>;
}

export type FavoriteStore = DbPort<unknown, string>;

export class FavoriteValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FavoriteValidationError";
  }
}

const favoriteNamespace = "user";
const favoriteKeyDelimiter = ":";

const readFavoritesScript = `
return redis.call("HGETALL", KEYS[1])
`;

const readFavoriteScript = `
return redis.call("HGET", KEYS[1], ARGV[1])
`;

const saveFavoriteScript = `
redis.call("HSET", KEYS[1], ARGV[1], ARGV[2])
return ARGV[2]
`;

const deleteFavoriteScript = `
redis.call("HDEL", KEYS[1], ARGV[1])
return redis.call("HGETALL", KEYS[1])
`;

const migrateFavoriteScript = `
local current = redis.call("HGET", KEYS[1], ARGV[1])
if not current then
  return nil
end
redis.call("HSET", KEYS[1], ARGV[2], ARGV[3])
redis.call("HDEL", KEYS[1], ARGV[1])
return ARGV[3]
`;

export function createFavoriteStore(): FavoriteStore {
  return createDbAdapter<unknown>({ namespace: favoriteNamespace });
}

export function createFavoriteKey(source: string, id: string) {
  return `${source.trim()}${favoriteKeyDelimiter}${id.trim()}`;
}

function createUserFavoriteHashKey(userId: string) {
  return `${userId}:fav`;
}

function defaultNowMs() {
  return Date.now();
}

function asObject(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new FavoriteValidationError("Request body must be an object.");
  }

  return input as Record<string, unknown>;
}

function readRequiredString(input: Record<string, unknown>, key: string) {
  const value = input[key];

  if (typeof value !== "string") {
    throw new FavoriteValidationError(`${key} is required.`);
  }

  const text = value.trim();
  if (!text) {
    throw new FavoriteValidationError(`${key} is required.`);
  }

  return text;
}

function toHashRecord(value: unknown): Record<string, string> {
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

function parseStoredFavorite(rawFavorite: string): StoredFavoriteRecord | null {
  try {
    const parsed = JSON.parse(rawFavorite) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }

    const favorite = parsed as Partial<StoredFavoriteRecord>;
    if (
      typeof favorite.cover !== "string" ||
      typeof favorite.douban_id !== "number" ||
      typeof favorite.original_episodes !== "number" ||
      (typeof favorite.index !== "undefined" && typeof favorite.index !== "string") ||
      typeof favorite.remarks !== "string" ||
      typeof favorite.save_time !== "number" ||
      typeof favorite.search_title !== "string" ||
      typeof favorite.source_name !== "string" ||
      typeof favorite.title !== "string" ||
      typeof favorite.year !== "string"
    ) {
      return null;
    }

    return favorite as StoredFavoriteRecord;
  } catch {
    return null;
  }
}

function sortFavorites(favorites: FavoriteItem[]) {
  return [...favorites].sort((left, right) => right.save_time - left.save_time);
}

function parseFavoriteEntry(field: string, rawFavorite: string): FavoriteItem | null {
  const delimiterIndex = field.indexOf(favoriteKeyDelimiter);

  if (delimiterIndex <= 0 || delimiterIndex === field.length - 1) {
    return null;
  }

  const record = parseStoredFavorite(rawFavorite);

  if (!record) {
    return null;
  }

  return {
    id: field.slice(delimiterIndex + 1),
    source: field.slice(0, delimiterIndex),
    ...record,
  };
}

async function readFavoriteRecord(userId: string, store: FavoriteStore) {
  return toHashRecord(
    await store.script(readFavoritesScript, {
      keys: [createUserFavoriteHashKey(userId)],
      readOnly: true,
    }),
  );
}

function readFavoriteInput(input: unknown) {
  const payload = asObject(input);

  return {
    id: readRequiredString(payload, "id"),
    source: readRequiredString(payload, "source"),
  };
}

async function findSource(sourceKey: string, videoSourceStore: VideoSourceStore) {
  const collection = await getVideoSources(videoSourceStore);
  const source = collection.sources.find((item) => item.key === sourceKey && item.status === "enabled");

  if (!source) {
    throw new FavoriteValidationError("source not found.");
  }

  return {
    apiUrl: source.apiUrl,
    key: source.key,
    name: source.name,
  };
}

function createFavoriteIndex(detail: {
  className?: string;
  title: string;
  typeName?: string;
  year: string;
}) {
  return createMediaSearchIndex(detail);
}

export async function createFavorite(input: unknown, options: FavoriteServiceOptions) {
  const { id, source: sourceKey } = readFavoriteInput(input);
  const store = options.store ?? createFavoriteStore();
  const videoSourceStore = options.videoSourceStore ?? createVideoSourceStore();
  const favoriteKey = createFavoriteKey(sourceKey, id);
  const source = await findSource(sourceKey, videoSourceStore);
  const detail = await (options.detailFetcher ?? getVideoSourceDetail)(source, id, {
    ...(options.fetcher ? { fetcher: options.fetcher } : {}),
    ...(options.timeoutMs === undefined ? {} : { timeoutMs: options.timeoutMs }),
  });
  const episodeCount = detail.episodes.length;
  const index = createFavoriteIndex({
    className: detail.className,
    title: detail.title,
    typeName: detail.typeName,
    year: detail.year,
  });
  const record: StoredFavoriteRecord = {
    cover: detail.posterUrl,
    douban_id: 0,
    index,
    original_episodes: episodeCount,
    remarks: detail.remarks || (episodeCount > 0 ? `更新至${episodeCount}集` : ""),
    save_time: options.now?.() ?? defaultNowMs(),
    search_title: "",
    source_name: detail.sourceName,
    title: detail.title,
    year: detail.year,
  };

  await store.script(saveFavoriteScript, {
    args: [favoriteKey, JSON.stringify(record)],
    keys: [createUserFavoriteHashKey(options.userId)],
  });

  return { id, source: sourceKey, ...record };
}

export async function migrateFavoriteRecord(
  input: MigrateFavoriteInput,
  options: MigrateFavoriteOptions,
) {
  const current = {
    id: input.current.id.trim(),
    source: input.current.source.trim(),
  };
  const target = {
    id: input.target.id.trim(),
    source: input.target.source.trim(),
  };

  if (!current.id || !current.source || !target.id || !target.source) {
    throw new FavoriteValidationError("current and target favorite keys are required.");
  }

  if (current.id === target.id && current.source === target.source) {
    return null;
  }

  const store = options.store ?? createFavoriteStore();
  const userFavoriteHashKey = createUserFavoriteHashKey(options.userId);
  const currentFavoriteKey = createFavoriteKey(current.source, current.id);
  const targetFavoriteKey = createFavoriteKey(target.source, target.id);
  const currentRawFavorite = await store.script<string | null>(readFavoriteScript, {
    args: [currentFavoriteKey],
    keys: [userFavoriteHashKey],
    readOnly: true,
  });

  if (!currentRawFavorite) {
    return null;
  }

  const currentFavorite = parseStoredFavorite(currentRawFavorite);

  if (!currentFavorite) {
    return null;
  }

  const videoSourceStore = options.videoSourceStore ?? createVideoSourceStore();
  const source = await findSource(target.source, videoSourceStore);
  const detail = options.detail ?? await (options.detailFetcher ?? getVideoSourceDetail)(source, target.id, {
    ...(options.fetcher ? { fetcher: options.fetcher } : {}),
    ...(options.timeoutMs === undefined ? {} : { timeoutMs: options.timeoutMs }),
  });
  const episodeCount = detail.episodes.length;
  const record: StoredFavoriteRecord = {
    cover: detail.posterUrl,
    douban_id: currentFavorite.douban_id,
    index: createFavoriteIndex({
      className: detail.className,
      title: detail.title,
      typeName: detail.typeName,
      year: detail.year,
    }),
    original_episodes: episodeCount,
    remarks: detail.remarks || (episodeCount > 0 ? `更新至${episodeCount}集` : ""),
    save_time: currentFavorite.save_time,
    search_title: currentFavorite.search_title,
    source_name: detail.sourceName,
    title: detail.title,
    year: detail.year,
  };

  const migratedFavorite = await store.script<string | null>(migrateFavoriteScript, {
    args: [currentFavoriteKey, targetFavoriteKey, JSON.stringify(record)],
    keys: [userFavoriteHashKey],
  });

  if (!migratedFavorite) {
    return null;
  }

  return { id: target.id, source: target.source, ...record };
}

export async function listFavorites(userId: string, { store = createFavoriteStore() }: { store?: FavoriteStore } = {}) {
  return sortFavorites(
    Object.entries(await readFavoriteRecord(userId, store))
      .map(([field, value]) => parseFavoriteEntry(field, value))
      .filter((favorite): favorite is FavoriteItem => favorite !== null),
  );
}

export async function hasFavorite(
  userId: string,
  input: unknown,
  { store = createFavoriteStore() }: { store?: FavoriteStore } = {},
) {
  const { id, source } = readFavoriteInput(input);
  const favoriteKey = createFavoriteKey(source, id);

  return Boolean(
    await store.script(readFavoriteScript, {
      args: [favoriteKey],
      keys: [createUserFavoriteHashKey(userId)],
      readOnly: true,
    }),
  );
}

export async function deleteFavorite(
  userId: string,
  input: unknown,
  { store = createFavoriteStore() }: { store?: FavoriteStore } = {},
) {
  const { id, source } = readFavoriteInput(input);
  const normalizedFavoriteKey = createFavoriteKey(source, id);

  if (!normalizedFavoriteKey) {
    throw new FavoriteValidationError("favorite key is required.");
  }

  const result = await store.script(deleteFavoriteScript, {
    args: [normalizedFavoriteKey],
    keys: [createUserFavoriteHashKey(userId)],
  });

  return sortFavorites(
    Object.entries(toHashRecord(result))
      .map(([field, value]) => parseFavoriteEntry(field, value))
      .filter((favorite): favorite is FavoriteItem => favorite !== null),
  );
}
