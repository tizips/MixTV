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

function parseStoredPlaybackProgress(rawProgress: string): StoredPlaybackProgressRecord | null {
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

function parseHistoryEntry(field: string, rawProgress: string): HistoryItem | null {
  const delimiterIndex = field.indexOf(":");

  if (delimiterIndex <= 0 || delimiterIndex === field.length - 1) {
    return null;
  }

  const record = parseStoredPlaybackProgress(rawProgress);

  if (!record) {
    return null;
  }

  return {
    id: field.slice(delimiterIndex + 1),
    source: field.slice(0, delimiterIndex),
    ...record,
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
  return sortHistory(
    Object.entries(await readHistoryRecord(userId, store))
      .map(([field, value]) => parseHistoryEntry(field, value))
      .filter((history): history is HistoryItem => history !== null),
  );
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
    total_episodes: Math.max(0, Math.floor(totalEpisodes)),
  };

  await store.script(saveHistoryScript, {
    args: [field, JSON.stringify(updatedHistory)],
    keys: [createUserPlaybackProgressHashKey(userId)],
  });

  return updatedHistory;
}
