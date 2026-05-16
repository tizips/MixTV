import { createDbAdapter } from "@/infrastructure/db/db-adapter";
import type { DbPort } from "@/shared/db/db-port";

const maxSearchHistoryItems = 20;
const searchHistoryNamespace = "user";
const lastSearchHistoryIndex = maxSearchHistoryItems - 1;

const listSearchHistoryScript = `
return redis.call("LRANGE", KEYS[1], 0, tonumber(ARGV[1]))
`;

const addSearchHistoryScript = `
redis.call("LREM", KEYS[1], 0, ARGV[1])
redis.call("LPUSH", KEYS[1], ARGV[1])
redis.call("LTRIM", KEYS[1], 0, tonumber(ARGV[2]))
return redis.call("LRANGE", KEYS[1], 0, tonumber(ARGV[2]))
`;

const deleteSearchHistoryScript = `
redis.call("LREM", KEYS[1], 0, ARGV[1])
return redis.call("LRANGE", KEYS[1], 0, tonumber(ARGV[2]))
`;

const clearSearchHistoryScript = `
redis.call("DEL", KEYS[1])
return {}
`;

let searchHistoryStore: DbPort<string, string> | null = null;

function getSearchHistoryStore() {
  searchHistoryStore ??= createDbAdapter<string>({ namespace: searchHistoryNamespace });

  return searchHistoryStore;
}

export function resetSearchHistoryStoreForTest() {
  searchHistoryStore = null;
}

function toSearchHistory(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

function createSearchHistoryKey(userId: string) {
  return `${userId}:sh`;
}

export async function listSearchHistory(userId: string) {
  const result = await getSearchHistoryStore().script(listSearchHistoryScript, {
    args: [lastSearchHistoryIndex],
    keys: [createSearchHistoryKey(userId)],
    readOnly: true,
  });

  return toSearchHistory(result);
}

export async function addSearchHistory(userId: string, keyword: string) {
  const normalizedKeyword = keyword.trim();

  if (!normalizedKeyword) {
    return listSearchHistory(userId);
  }

  const result = await getSearchHistoryStore().script(addSearchHistoryScript, {
    args: [normalizedKeyword, lastSearchHistoryIndex],
    keys: [createSearchHistoryKey(userId)],
  });

  return toSearchHistory(result);
}

export async function deleteSearchHistory(userId: string, keyword: string) {
  const normalizedKeyword = keyword.trim();

  if (normalizedKeyword) {
    const result = await getSearchHistoryStore().script(deleteSearchHistoryScript, {
      args: [normalizedKeyword, lastSearchHistoryIndex],
      keys: [createSearchHistoryKey(userId)],
    });

    return toSearchHistory(result);
  }

  return listSearchHistory(userId);
}

export async function clearSearchHistory(userId: string) {
  const result = await getSearchHistoryStore().script(clearSearchHistoryScript, {
    keys: [createSearchHistoryKey(userId)],
  });

  return toSearchHistory(result);
}
