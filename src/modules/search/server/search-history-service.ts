import {
  deleteEdgeOneKvEntry,
  getEdgeOneKvBinding,
  readEdgeOneKvList,
  type EdgeOneKvBinding,
  writeEdgeOneKvList,
} from "@/infrastructure/db/edgeone-kv-db-adapter";

const maxSearchHistoryItems = 20;
const searchHistoryNamespace = "user";
const searchHistoryKvBindingName = "user";
let searchHistoryStore: EdgeOneKvBinding | null = null;

function getSearchHistoryStore() {
  searchHistoryStore ??= getEdgeOneKvBinding({
    bindingName: searchHistoryKvBindingName,
  });

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
  const result = await readEdgeOneKvList(getSearchHistoryStore(), createSearchHistoryKey(userId), {
    namespace: searchHistoryNamespace,
  });

  return toSearchHistory(result);
}

export async function addSearchHistory(userId: string, keyword: string) {
  const normalizedKeyword = keyword.trim();

  if (!normalizedKeyword) {
    return listSearchHistory(userId);
  }

  const store = getSearchHistoryStore();
  const key = createSearchHistoryKey(userId);
  const current = await readEdgeOneKvList(store, key, {
    namespace: searchHistoryNamespace,
  });
  const result = [normalizedKeyword, ...current.filter((item) => item !== normalizedKeyword)].slice(0, maxSearchHistoryItems);

  await writeEdgeOneKvList(store, key, result, { namespace: searchHistoryNamespace });

  return toSearchHistory(result);
}

export async function deleteSearchHistory(userId: string, keyword: string) {
  const normalizedKeyword = keyword.trim();

  if (normalizedKeyword) {
    const store = getSearchHistoryStore();
    const key = createSearchHistoryKey(userId);
    const current = await readEdgeOneKvList(store, key, {
      namespace: searchHistoryNamespace,
    });
    const result = current.filter((item) => item !== normalizedKeyword).slice(0, maxSearchHistoryItems);

    await writeEdgeOneKvList(store, key, result, { namespace: searchHistoryNamespace });

    return toSearchHistory(result);
  }

  return listSearchHistory(userId);
}

export async function clearSearchHistory(userId: string) {
  await deleteEdgeOneKvEntry(getSearchHistoryStore(), createSearchHistoryKey(userId), {
    namespace: searchHistoryNamespace,
  });

  return [];
}
