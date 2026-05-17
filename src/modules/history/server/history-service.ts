import { createPlaybackProgressField, createPlaybackProgressStore, type PlaybackProgressRecord, type PlaybackProgressStore, type StoredPlaybackProgressRecord } from "@/modules/playback/server/playback-progress-service";

export type HistoryItem = PlaybackProgressRecord;

export type HistoryStore = PlaybackProgressStore;

export interface HistoryServiceOptions {
  store?: HistoryStore;
}

export class HistoryValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HistoryValidationError";
  }
}

const readHistoryScript = `
return redis.call("HGETALL", KEYS[1])
`;

const deleteHistoryScript = `
redis.call("HDEL", KEYS[1], ARGV[1])
return redis.call("HGETALL", KEYS[1])
`;

const saveHistoryScript = `
redis.call("HSET", KEYS[1], ARGV[1], ARGV[2])
return ARGV[2]
`;

function createUserPlaybackProgressHashKey(userId: string) {
  return `${userId}:pr`;
}

function asObject(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new HistoryValidationError("Request body must be an object.");
  }

  return input as Record<string, unknown>;
}

function readRequiredString(input: Record<string, unknown>, key: string) {
  const value = input[key];

  if (typeof value !== "string") {
    throw new HistoryValidationError(`${key} is required.`);
  }

  const text = value.trim();

  if (!text) {
    throw new HistoryValidationError(`${key} is required.`);
  }

  return text;
}

function readHistoryInput(input: unknown) {
  const payload = asObject(input);

  return {
    id: readRequiredString(payload, "id"),
    source: readRequiredString(payload, "source"),
  };
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

function parseStoredPlaybackProgress(rawProgress: string): {
  needsMigration: boolean;
  record: StoredPlaybackProgressRecord | null;
} {
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

function parseHistoryEntry(field: string, rawProgress: string): {
  needsMigration: boolean;
  item: HistoryItem | null;
} {
  const delimiterIndex = field.indexOf(":");

  if (delimiterIndex <= 0 || delimiterIndex === field.length - 1) {
    return { needsMigration: false, item: null };
  }

  const parsed = parseStoredPlaybackProgress(rawProgress);

  if (!parsed.record) {
    return { needsMigration: false, item: null };
  }

  return {
    needsMigration: parsed.needsMigration,
    item: {
      id: field.slice(delimiterIndex + 1),
      source: field.slice(0, delimiterIndex),
      ...parsed.record,
    },
  };
}

function sortHistory(history: HistoryItem[]) {
  return [...history].sort((left, right) => right.save_time - left.save_time);
}

async function readHistoryRecord(userId: string, store: HistoryStore) {
  return toHashRecord(
    await store.script(readHistoryScript, {
      keys: [createUserPlaybackProgressHashKey(userId)],
      readOnly: true,
    }),
  );
}

export async function listPlaybackHistory(userId: string, { store = createPlaybackProgressStore() }: HistoryServiceOptions = {}) {
  const historyEntries = Object.entries(await readHistoryRecord(userId, store))
    .map(([field, value]) => parseHistoryEntry(field, value))
    .filter((entry): entry is { needsMigration: boolean; item: HistoryItem } => entry.item !== null);

  await Promise.all(
    historyEntries
      .filter((entry) => entry.needsMigration)
      .map((entry) =>
        store.script(saveHistoryScript, {
          args: [createPlaybackProgressField(entry.item.source, entry.item.id), JSON.stringify(entry.item)],
          keys: [createUserPlaybackProgressHashKey(userId)],
        }),
      ),
  );

  return sortHistory(historyEntries.map((entry) => entry.item));
}

export async function deleteHistoryPlaybackProgress(
  userId: string,
  input: unknown,
  { store = createPlaybackProgressStore() }: HistoryServiceOptions = {},
) {
  const { id, source } = readHistoryInput(input);
  const field = createPlaybackProgressField(source, id);

  await store.script(deleteHistoryScript, {
    args: [field],
    keys: [createUserPlaybackProgressHashKey(userId)],
  });

  return listPlaybackHistory(userId, { store });
}

export async function updatePlaybackHistoryTotalEpisodes(
  userId: string,
  history: HistoryItem,
  totalEpisodes: number,
  { store = createPlaybackProgressStore() }: HistoryServiceOptions = {},
) {
  const field = createPlaybackProgressField(history.source, history.id);
  const updatedHistory: HistoryItem = {
    ...history,
    original_episodes: Math.max(0, Math.floor(totalEpisodes)),
  };

  await store.script(saveHistoryScript, {
    args: [field, JSON.stringify(updatedHistory)],
    keys: [createUserPlaybackProgressHashKey(userId)],
  });

  return updatedHistory;
}
